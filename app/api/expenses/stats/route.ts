import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { EXPENSE_TABLE_NAME, mapExpenseRowToRecord, type ExpenseRow } from '../../../../lib/expenseMapper'
import { TRIP_TABLE_NAME } from '../../../../lib/tripMapper'
import type { ExpenseRecord, ExpenseStatsResponse } from '../../../../types/expense'
import { applyExpenseFilters, normalizeString } from '../helpers'

function parseNumeric(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        if (Number.isFinite(parsed)) {
            return parsed
        }
    }
    return null
}

function buildCategoryStats(records: ExpenseRecord[], total: number) {
    const map = new Map<string, { amount: number; count: number }>()
    records.forEach(record => {
        const key = record.category
        const current = map.get(key) ?? { amount: 0, count: 0 }
        current.amount += record.amount
        current.count += 1
        map.set(key, current)
    })

    return Array.from(map.entries())
        .map(([category, value]) => ({
            category: category as any,
            amount: Number(value.amount.toFixed(2)),
            count: value.count,
            ratio: total > 0 ? value.amount / total : 0
        }))
        .sort((a, b) => b.amount - a.amount)
}

function buildDateStats(records: ExpenseRecord[]) {
    const map = new Map<string, number>()
    records.forEach(record => {
        const dateKey = record.spent_at
        const current = map.get(dateKey) ?? 0
        map.set(dateKey, current + record.amount)
    })

    return Array.from(map.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, amount]) => ({ date, amount: Number(amount.toFixed(2)) }))
}

export async function GET(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请先登录。' }, { status: 401 })
    }

    const params = new URL(request.url).searchParams
    const tripId = normalizeString(params.get('trip_id'))

    if (!tripId) {
        return NextResponse.json({ error: '必须提供 trip_id。' }, { status: 400 })
    }

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
    const totalSpent = expenseRecords.reduce((total, record) => total + record.amount, 0)

    let budgetTotal: number | null = null

    const { data: tripRow, error: tripError } = await supabase
        .from(TRIP_TABLE_NAME)
        .select('budget')
        .eq('user_id', user.id)
        .eq('id', tripId)
        .maybeSingle()

    if (!tripError && tripRow?.budget) {
        const rawTotal = (tripRow as any).budget?.total
        const parsed = parseNumeric(rawTotal)
        if (parsed !== null) {
            budgetTotal = parsed
        }
    }

    const response: ExpenseStatsResponse = {
        trip_id: tripId,
        total_spent: Number(totalSpent.toFixed(2)),
        budget_total: budgetTotal,
        budget_delta: budgetTotal !== null ? Number((budgetTotal - totalSpent).toFixed(2)) : null,
        by_category: buildCategoryStats(expenseRecords, totalSpent),
        by_date: buildDateStats(expenseRecords)
    }

    return NextResponse.json({ data: response })
}
