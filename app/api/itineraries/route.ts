import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { buildTripInsertPayload, mapTripRowToRecord, TRIP_TABLE_NAME } from '../../../lib/tripMapper'
import { validateTripPlan, validateTripRequest } from '../../../lib/tripValidation'
import type { TripPlanRow } from '../../../types/trip'

export async function GET() {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请先登录。' }, { status: 401 })
    }

    const { data, error } = await supabase
        .from(TRIP_TABLE_NAME)
        .select(
            'id, user_id, city, start_date, end_date, plan_days, weather, overall_suggestions, budget, request, created_at, updated_at'
        )
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const records = (data ?? []).map(row => mapTripRowToRecord(row as TripPlanRow))

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

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: '请求体必须是合法的 JSON。' }, { status: 400 })
    }

    const plan = body?.plan
    const tripRequest = body?.request ?? null

    try {
        validateTripPlan(plan)
    } catch (err) {
        return NextResponse.json({ error: err instanceof Error ? err.message : '行程数据格式错误。' }, { status: 400 })
    }

    if (!validateTripRequest(tripRequest)) {
        return NextResponse.json({ error: 'TripRequest 数据格式不正确。' }, { status: 400 })
    }

    const payload = buildTripInsertPayload(plan, user.id, tripRequest)

    const { data, error } = await supabase
        .from(TRIP_TABLE_NAME)
        .insert(payload)
        .select(
            'id, user_id, city, start_date, end_date, plan_days, weather, overall_suggestions, budget, request, created_at, updated_at'
        )
        .single()

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data: mapTripRowToRecord(data as TripPlanRow) }, { status: 201 })
}
