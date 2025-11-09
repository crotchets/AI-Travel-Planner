import { EXPENSE_CATEGORY_VALUES, PAYMENT_METHOD_VALUES } from '../../../lib/expenseCatalog'
import type { ExpenseInsertInput, ExpenseUpdateInput } from '../../../types/expense'

export function parseAmount(value: unknown): number | null {
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

export function normalizeString(value: unknown) {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

export function ensureDateString(value: unknown) {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return null
    }
    return trimmed
}

export function isValidCategory(value: string | null): value is string {
    return !!value && EXPENSE_CATEGORY_VALUES.includes(value as any)
}

export function isValidPaymentMethod(value: string | null): value is string {
    return !!value && PAYMENT_METHOD_VALUES.includes(value as any)
}

export function sanitizeInsertPayload(body: Record<string, unknown>): { payload?: ExpenseInsertInput; error?: string } {
    const tripId = normalizeString(body.trip_id)
    if (!tripId) {
        return { error: 'trip_id 为必填字段。' }
    }

    const rawAmount = parseAmount(body.amount)
    if (rawAmount === null || rawAmount <= 0) {
        return { error: 'amount 必须为大于 0 的数字。' }
    }

    const category = normalizeString(body.category)
    if (!isValidCategory(category)) {
        return { error: 'category 不在允许范围内。' }
    }

    const paymentMethod = normalizeString(body.payment_method)
    if (!isValidPaymentMethod(paymentMethod)) {
        return { error: 'payment_method 不在允许范围内。' }
    }

    const spentAt = ensureDateString(body.spent_at)
    if (!spentAt) {
        return { error: 'spent_at 必须为 YYYY-MM-DD 格式。' }
    }

    const currency = 'currency' in body ? normalizeString(body.currency) : null
    const description = 'description' in body ? normalizeString(body.description) : null
    const source = 'source' in body ? normalizeString(body.source) : null

    return {
        payload: {
            trip_id: tripId,
            amount: rawAmount,
            currency,
            category: category as any,
            payment_method: paymentMethod as any,
            spent_at: spentAt,
            description,
            source: source === 'voice' ? 'voice' : 'manual'
        }
    }
}

export function sanitizeUpdatePayload(body: Record<string, unknown>): { payload?: ExpenseUpdateInput; error?: string } {
    const payload: ExpenseUpdateInput = {}

    if ('amount' in body) {
        const amount = parseAmount(body.amount)
        if (amount === null || amount <= 0) {
            return { error: 'amount 必须为大于 0 的数字。' }
        }
        payload.amount = amount
    }

    if ('currency' in body) {
        payload.currency = normalizeString(body.currency)
    }

    if ('category' in body) {
        const category = normalizeString(body.category)
        if (!isValidCategory(category)) {
            return { error: 'category 不在允许范围内。' }
        }
        payload.category = category as any
    }

    if ('payment_method' in body) {
        const paymentMethod = normalizeString(body.payment_method)
        if (!isValidPaymentMethod(paymentMethod)) {
            return { error: 'payment_method 不在允许范围内。' }
        }
        payload.payment_method = paymentMethod as any
    }

    if ('spent_at' in body) {
        const spentAt = ensureDateString(body.spent_at)
        if (!spentAt) {
            return { error: 'spent_at 必须为 YYYY-MM-DD 格式。' }
        }
        payload.spent_at = spentAt
    }

    if ('description' in body) {
        payload.description = normalizeString(body.description)
    }

    if ('source' in body) {
        const source = normalizeString(body.source)
        if (source && source !== 'voice' && source !== 'manual') {
            return { error: 'source 仅支持 manual 或 voice。' }
        }
        payload.source = source === 'voice' ? 'voice' : source === 'manual' ? 'manual' : null
    }

    if (Object.keys(payload).length === 0) {
        return { error: '未检测到可更新的字段。' }
    }

    return { payload }
}

export function applyExpenseFilters(query: any, params: URLSearchParams) {
    const category = normalizeString(params.get('category'))
    if (isValidCategory(category)) {
        query = query.eq('category', category)
    }

    const paymentMethod = normalizeString(params.get('payment_method'))
    if (isValidPaymentMethod(paymentMethod)) {
        query = query.eq('payment_method', paymentMethod)
    }

    const startDate = ensureDateString(params.get('start_date'))
    if (startDate) {
        query = query.gte('spent_at', startDate)
    }

    const endDate = ensureDateString(params.get('end_date'))
    if (endDate) {
        query = query.lte('spent_at', endDate)
    }

    return query
}
