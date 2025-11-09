import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
    buildExpenseUpdatePayload,
    EXPENSE_TABLE_NAME,
    mapExpenseRowToRecord,
    type ExpenseRow
} from '../../../../lib/expenseMapper'
import { sanitizeUpdatePayload } from '../helpers'

interface RouteContext {
    params: { id: string }
}

function normalizeId(value: string | undefined) {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

export async function PUT(request: Request, { params }: RouteContext) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请先登录。' }, { status: 401 })
    }

    const id = normalizeId(params?.id)
    if (!id) {
        return NextResponse.json({ error: '缺少有效的费用记录 ID。' }, { status: 400 })
    }

    let body: Record<string, unknown>
    try {
        body = (await request.json()) as Record<string, unknown>
    } catch {
        return NextResponse.json({ error: '请求体必须是合法的 JSON。' }, { status: 400 })
    }

    const { payload, error: validationError } = sanitizeUpdatePayload(body)
    if (!payload || validationError) {
        return NextResponse.json({ error: validationError ?? '请求数据不合法。' }, { status: 422 })
    }

    const updatePayload = buildExpenseUpdatePayload(payload)
    if (Object.keys(updatePayload).length === 0) {
        return NextResponse.json({ error: '未包含任何可更新的字段。' }, { status: 400 })
    }

    const { data, error } = await supabase
        .from(EXPENSE_TABLE_NAME)
        .update(updatePayload)
        .eq('user_id', user.id)
        .eq('id', id)
        .select(
            'id, trip_id, user_id, amount, currency, category, payment_method, spent_at, description, created_at, updated_at, source'
        )
        .single()

    if (error) {
        if ((error as any)?.code === 'PGRST116') {
            return NextResponse.json({ error: '未找到对应的费用记录。' }, { status: 404 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: mapExpenseRowToRecord(data as ExpenseRow) })
}

export async function DELETE(_request: Request, { params }: RouteContext) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请先登录。' }, { status: 401 })
    }

    const id = normalizeId(params?.id)
    if (!id) {
        return NextResponse.json({ error: '缺少有效的费用记录 ID。' }, { status: 400 })
    }

    const { error } = await supabase
        .from(EXPENSE_TABLE_NAME)
        .delete()
        .eq('user_id', user.id)
        .eq('id', id)
        .select('id')
        .single()

    if (error) {
        if ((error as any)?.code === 'PGRST116') {
            return NextResponse.json({ error: '未找到对应的费用记录。' }, { status: 404 })
        }
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
}
