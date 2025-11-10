import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { generateTripPlanFromRequest } from '../../../../lib/bailianClient'
import { loadUserRuntimeConfig } from '../../../../lib/runtimeConfig'
import { buildTripInsertPayload, mapTripRowToRecord, TRIP_TABLE_NAME } from '../../../../lib/tripMapper'
import { validateTripPlan, validateTripRequest } from '../../../../lib/tripValidation'
import type { TripPlanRow, TripRequest } from '../../../../types/trip'

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请登录后再生成行程。' }, { status: 401 })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: '请求体必须是合法的 JSON。' }, { status: 400 })
    }

    const tripRequest = body?.request as TripRequest | null | undefined
    const hint = typeof body?.prompt === 'string' ? body.prompt.trim() : undefined

    if (!validateTripRequest(tripRequest) || !tripRequest) {
        return NextResponse.json({ error: 'TripRequest 数据缺失或格式不正确。' }, { status: 400 })
    }

    const sanitizedRequest: TripRequest = {
        city: tripRequest.city.trim(),
        start_date: tripRequest.start_date.trim(),
        end_date: tripRequest.end_date.trim(),
        travel_days: typeof tripRequest.travel_days === 'number' ? tripRequest.travel_days : undefined,
        transportation: tripRequest.transportation?.trim() || undefined,
        accommodation: tripRequest.accommodation?.trim() || undefined,
        preferences: Array.isArray(tripRequest.preferences)
            ? tripRequest.preferences.filter(item => typeof item === 'string' && item.trim().length > 0)
            : undefined,
        budget_level: tripRequest.budget_level?.trim() || undefined,
        free_text_input: tripRequest.free_text_input?.trim() || undefined
    }

    try {
        const runtimeConfig = await loadUserRuntimeConfig(supabase, user.id)
        const plan = await generateTripPlanFromRequest(sanitizedRequest, { userPrompt: hint, runtimeConfig })
        validateTripPlan(plan)

        const payload = buildTripInsertPayload(plan, user.id, sanitizedRequest)
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

        const record = mapTripRowToRecord(data as TripPlanRow)
        return NextResponse.json({ data: record })
    } catch (err) {
        console.error('generate trip plan failed', err)
        return NextResponse.json({ error: err instanceof Error ? err.message : '生成行程失败。' }, { status: 500 })
    }
}
