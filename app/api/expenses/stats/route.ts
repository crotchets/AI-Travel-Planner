import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { EXPENSE_TABLE_NAME, mapExpenseRowToRecord, type ExpenseRow } from '../../../../lib/expenseMapper'
import { TRIP_TABLE_NAME } from '../../../../lib/tripMapper'
import type { ExpenseRecord } from '../../../../types/expense'
import { applyExpenseFilters, normalizeString } from '../helpers'
import { summarizeExpenseStats } from '../../../../lib/expenseStats'

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

    const summary = summarizeExpenseStats(tripId, expenseRecords, budgetTotal)

    return NextResponse.json({ data: summary.response })
}
