import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import {
    getEnvDefaults,
    loadUserRuntimeConfig,
    mergeRuntimeConfig,
    sanitizeConfigInput,
    upsertUserRuntimeConfig
} from '../../../../lib/runtimeConfig'

export async function GET() {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请登录后再访问设置。' }, { status: 401 })
    }

    try {
        const overrides = await loadUserRuntimeConfig(supabase, user.id)
        const defaults = getEnvDefaults()
        const effective = mergeRuntimeConfig(defaults, overrides)

        return NextResponse.json({ data: { overrides: overrides ?? {}, effective } })
    } catch (error) {
        console.error('settings config GET failed', error)
        return NextResponse.json({ error: '加载设置失败，请稍后再试。' }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请登录后再保存设置。' }, { status: 401 })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: '请求体必须是合法的 JSON。' }, { status: 400 })
    }

    const overrides = sanitizeConfigInput(body?.config ?? {})
    for (const key of Object.keys(overrides) as Array<keyof typeof overrides>) {
        if (!overrides[key]) {
            delete overrides[key]
        }
    }

    try {
        await upsertUserRuntimeConfig(supabase, user.id, overrides)
        const defaults = getEnvDefaults()
        const effective = mergeRuntimeConfig(defaults, overrides)
        return NextResponse.json({ data: { overrides, effective } })
    } catch (error) {
        console.error('settings config PUT failed', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : '保存设置失败。' }, { status: 500 })
    }
}
