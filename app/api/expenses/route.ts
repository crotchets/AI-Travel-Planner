import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
    buildExpenseInsertPayload,
    EXPENSE_TABLE_NAME,
    mapExpenseRowToRecord,
    type ExpenseRow
} from '../../../lib/expenseMapper'
import { applyExpenseFilters, normalizeString, sanitizeInsertPayload } from './helpers'

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

    let query = supabase
        .from(EXPENSE_TABLE_NAME)
        .select(
            'id, trip_id, user_id, amount, currency, category, payment_method, spent_at, description, created_at, updated_at, source'
        )
        .eq('user_id', user.id)
        .eq('trip_id', tripId)
        .order('spent_at', { ascending: false })
        .order('created_at', { ascending: false })

    query = applyExpenseFilters(query, params)

    const { data, error } = await query

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const records = (data ?? []).map(row => mapExpenseRowToRecord(row as ExpenseRow))

    return NextResponse.json({ data: records })
}

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请先登录。' }, { status: 401 })
    }

    let body: Record<string, unknown>
    try {
        body = (await request.json()) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: '请求体必须是合法的 JSON。' }, { status: 400 })
    }

    const { payload, error: validationError } = sanitizeInsertPayload(body)

    if (!payload || validationError) {
        return NextResponse.json({ error: validationError ?? '请求数据不合法。' }, { status: 422 })
    }

    const insertPayload = buildExpenseInsertPayload(payload, user.id)

    const { data, error } = await supabase
        .from(EXPENSE_TABLE_NAME)
        .insert(insertPayload)
        .select(
            'id, trip_id, user_id, amount, currency, category, payment_method, spent_at, description, created_at, updated_at, source'
        )
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: mapExpenseRowToRecord(data as ExpenseRow) }, { status: 201 })
}
