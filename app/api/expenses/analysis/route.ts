import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { callBailianChatCompletion } from '../../../../lib/bailianClient'
import { EXPENSE_CATEGORY_CATALOG } from '../../../../lib/expenseCatalog'
import { EXPENSE_TABLE_NAME, mapExpenseRowToRecord, type ExpenseRow } from '../../../../lib/expenseMapper'
import { summarizeExpenseStats } from '../../../../lib/expenseStats'
import { TRIP_TABLE_NAME } from '../../../../lib/tripMapper'
import type { ExpenseAnalysisResponse, ExpenseRecord } from '../../../../types/expense'
import { applyExpenseFilters, ensureDateString, normalizeString } from '../helpers'
import { loadUserRuntimeConfig } from '../../../../lib/runtimeConfig'

const ANALYSIS_SCHEMA = {
    type: 'object',
    required: ['spending_overview', 'summary', 'budget_status', 'recommendations'],
    additionalProperties: false,
    properties: {
        spending_overview: {
            type: 'array',
            minItems: 1,
            description: '用简洁句子概述当前支出情况（开销规模、预算占比、主要类别等）。',
            items: {
                type: 'string'
            }
        },
        summary: {
            type: 'string',
            description: '总体概述，用 2-3 句话总结当前支出情况与预算对比。'
        },
        budget_status: {
            type: 'string',
            enum: ['over_budget', 'under_budget', 'on_track'],
            description: '整体状态：超支、节省或基本符合预算。'
        },
        key_observations: {
            type: 'array',
            description: '列出 2-4 条观察结果。',
            items: {
                type: 'object',
                required: ['title', 'detail'],
                additionalProperties: false,
                properties: {
                    title: { type: 'string' },
                    detail: { type: 'string' }
                }
            }
        },
        recommendations: {
            type: 'array',
            minItems: 1,
            description: '提供具体建议（消费优化、预算调整等）。',
            items: { type: 'string' }
        },
        saving_tips: {
            type: 'array',
            description: '节省成本的小贴士（可选）。',
            items: { type: 'string' }
        },
        risk_warnings: {
            type: 'array',
            description: '潜在风险提醒（可选）。',
            items: { type: 'string' }
        }
    }
}

interface AnalysisModelResult {
    spending_overview: string[]
    summary: string
    budget_status: 'over_budget' | 'under_budget' | 'on_track'
    key_observations?: Array<{ title: string; detail: string }>
    recommendations: string[]
    saving_tips?: string[]
    risk_warnings?: string[]
}

function buildFiltersSearchParams(filters: Record<string, unknown> | undefined) {
    const params = new URLSearchParams()
    if (!filters) return params

    const category = normalizeString(filters.category)
    if (category) {
        params.set('category', category)
    }

    const paymentMethod = normalizeString(filters.payment_method)
    if (paymentMethod) {
        params.set('payment_method', paymentMethod)
    }

    const startDate = ensureDateString(filters.start_date)
    if (startDate) {
        params.set('start_date', startDate)
    }

    const endDate = ensureDateString(filters.end_date)
    if (endDate) {
        params.set('end_date', endDate)
    }

    return params
}

function getBudgetCurrency(tripBudget: any, records: ExpenseRecord[]): string | null {
    const fromBudget = typeof tripBudget?.currency === 'string' ? tripBudget.currency : null
    if (fromBudget) {
        return fromBudget
    }
    const recordCurrency = records.find(record => record.currency)?.currency
    return recordCurrency ?? null
}

function mapCategoryLabel(value: string) {
    return EXPENSE_CATEGORY_CATALOG.find(item => item.value === value)?.label ?? value
}

function buildSampleExpenses(records: ExpenseRecord[], limit = 5) {
    return [...records]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, limit)
        .map(record => ({
            amount: record.amount,
            currency: record.currency ?? null,
            category: record.category,
            category_label: mapCategoryLabel(record.category),
            spent_at: record.spent_at,
            description: record.description ?? null,
            payment_method: record.payment_method
        }))
}

function buildBudgetCategories(tripBudget: any) {
    if (!tripBudget?.categories || !Array.isArray(tripBudget.categories)) {
        return []
    }
    return tripBudget.categories
        .filter((item: any) => typeof item?.label === 'string' && typeof item?.amount === 'number')
        .map((item: any) => ({
            label: item.label,
            amount: item.amount,
            currency: item.currency ?? tripBudget.currency ?? null
        }))
}

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请登录后再试。' }, { status: 401 })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: '请求体需为 JSON。' }, { status: 400 })
    }

    const tripId = normalizeString(body?.trip_id)
    if (!tripId) {
        return NextResponse.json({ error: '缺少 trip_id。' }, { status: 400 })
    }

    const params = buildFiltersSearchParams(body?.filters)

    let expenseQuery = supabase
        .from(EXPENSE_TABLE_NAME)
        .select(
            'id, trip_id, user_id, amount, currency, category, payment_method, spent_at, description, created_at, updated_at, source'
        )
        .eq('user_id', user.id)
        .eq('trip_id', tripId)

    expenseQuery = applyExpenseFilters(expenseQuery, params)

    const { data: expenseRows, error: expenseError } = await expenseQuery

    if (expenseError) {
        return NextResponse.json({ error: expenseError.message }, { status: 500 })
    }

    const expenseRecords = (expenseRows ?? []).map(row => mapExpenseRowToRecord(row as ExpenseRow))

    const { data: tripRow, error: tripError } = await supabase
        .from(TRIP_TABLE_NAME)
        .select('city, start_date, end_date, budget')
        .eq('user_id', user.id)
        .eq('id', tripId)
        .maybeSingle()

    if (tripError) {
        return NextResponse.json({ error: tripError.message }, { status: 500 })
    }

    const tripBudget = tripRow?.budget ?? null
    const budgetTotal = typeof tripBudget?.total === 'number' ? tripBudget.total : null

    const summary = summarizeExpenseStats(tripId, expenseRecords, budgetTotal)

    const analysisContext = {
        trip: {
            city: tripRow?.city ?? '未知目的地',
            start_date: tripRow?.start_date ?? null,
            end_date: tripRow?.end_date ?? null,
            budget: tripBudget,
            budget_currency: getBudgetCurrency(tripBudget, expenseRecords)
        },
        filters: {
            category: params.get('category'),
            payment_method: params.get('payment_method'),
            start_date: params.get('start_date'),
            end_date: params.get('end_date')
        },
        stats: summary.response,
        top_categories: summary.byCategory.slice(0, 5).map(item => ({
            category: item.category,
            category_label: mapCategoryLabel(item.category),
            amount: item.amount,
            ratio: Number(item.ratio.toFixed(4))
        })),
        spending_trend: summary.byDate,
        budget_breakdown: buildBudgetCategories(tripBudget),
        sample_expenses: buildSampleExpenses(expenseRecords)
    }

    const runtimeConfig = await loadUserRuntimeConfig(supabase, user.id)

    const modelResponse = await callBailianChatCompletion({
        messages: [
            {
                role: 'system',
                content: [
                    '你是一名洞察旅行开销的智能财务规划师，擅长分析旅行预算执行情况。',
                    '请严格按照步骤输出：先用简明语句概述现状，再提供整体总结，最后给出具体建议。',
                    '保持语气友好、专业，输出不要包含 Markdown 代码块标记。',
                    '避免重复数据原文，可适当引用金额（保留两位小数）。'
                ].join('\n')
            },
            {
                role: 'user',
                content: [
                    '请根据以下旅行预算执行数据给出分析：',
                    JSON.stringify(analysisContext, null, 2),
                    '输出需满足提供的 JSON Schema。'
                ].join('\n\n')
            }
        ],
        temperature: 0.4,
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'ExpenseAnalysisSchema',
                strict: true,
                schema: ANALYSIS_SCHEMA
            }
        },
        runtimeConfig
    })

    const content = modelResponse.choices?.[0]?.message?.content
    if (!content) {
        return NextResponse.json({ error: 'AI 分析未返回结果，请稍后重试。' }, { status: 502 })
    }

    let parsed: AnalysisModelResult
    try {
        parsed = JSON.parse(content) as AnalysisModelResult
    } catch (err) {
        console.error('parse analysis result failed', err, content)
        return NextResponse.json({ error: 'AI 分析结果解析失败。' }, { status: 502 })
    }

    const spendingOverview = Array.isArray(parsed.spending_overview)
        ? parsed.spending_overview
            .filter(item => typeof item === 'string')
            .map(item => item.trim())
            .filter(item => item.length > 0)
        : []

    const responsePayload: ExpenseAnalysisResponse = {
        tripId,
        generatedAt: new Date().toISOString(),
        spendingOverview,
        summary: parsed.summary,
        budgetStatus: parsed.budget_status,
        keyObservations: parsed.key_observations ?? [],
        recommendations: parsed.recommendations,
        savingTips: parsed.saving_tips ?? [],
        riskWarnings: parsed.risk_warnings ?? []
    }

    return NextResponse.json({ data: responsePayload })
}
