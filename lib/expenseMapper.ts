import type {
    ExpenseCategoryKey,
    ExpenseInsertInput,
    ExpenseRecord,
    ExpenseSource,
    ExpenseUpdateInput,
    PaymentMethodKey
} from '../types/expense'

export const EXPENSE_TABLE_NAME = 'expense_record'

type RawNumeric = number | string | null

export interface ExpenseRow {
    id: string
    trip_id: string
    user_id?: string | null
    amount: RawNumeric
    currency?: string | null
    category: ExpenseCategoryKey
    payment_method: PaymentMethodKey
    spent_at: string
    description?: string | null
    created_at: string
    updated_at?: string | null
    source?: ExpenseSource | null
}

function parseAmount(value: RawNumeric): number {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : 0
    }
    return 0
}

function normalizeCurrency(value: string | null | undefined) {
    const trimmed = value?.trim()
    if (!trimmed) {
        return null
    }
    return trimmed.slice(0, 8).toUpperCase()
}

function normalizeDescription(value: string | null | undefined) {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
}

function normalizeDate(value: string) {
    if (!value) return value
    return value.slice(0, 10)
}

export function mapExpenseRowToRecord(row: ExpenseRow): ExpenseRecord {
    return {
        id: row.id,
        trip_id: row.trip_id,
        user_id: row.user_id ?? null,
        amount: parseAmount(row.amount),
        currency: row.currency ?? null,
        category: row.category,
        payment_method: row.payment_method,
        spent_at: normalizeDate(row.spent_at),
        description: normalizeDescription(row.description) ?? undefined,
        created_at: row.created_at,
        updated_at: row.updated_at ?? undefined,
        source: row.source ?? undefined
    }
}

export function buildExpenseInsertPayload(input: ExpenseInsertInput, userId: string) {
    return {
        user_id: userId,
        trip_id: input.trip_id,
        amount: input.amount,
        currency: normalizeCurrency(input.currency ?? null),
        category: input.category,
        payment_method: input.payment_method,
        spent_at: normalizeDate(input.spent_at),
        description: normalizeDescription(input.description ?? null),
        source: input.source ?? 'manual'
    }
}

export function buildExpenseUpdatePayload(input: ExpenseUpdateInput) {
    const payload: Record<string, unknown> = {}

    if (typeof input.amount === 'number' && Number.isFinite(input.amount)) {
        payload.amount = input.amount
    }
    if ('currency' in input) {
        payload.currency = normalizeCurrency(input.currency ?? null)
    }
    if (input.category) {
        payload.category = input.category
    }
    if (input.payment_method) {
        payload.payment_method = input.payment_method
    }
    if (input.spent_at) {
        payload.spent_at = normalizeDate(input.spent_at)
    }
    if ('description' in input) {
        payload.description = normalizeDescription(input.description ?? null)
    }
    if (input.source) {
        payload.source = input.source
    }

    return payload
}
