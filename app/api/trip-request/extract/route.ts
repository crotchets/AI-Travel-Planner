import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { extractTripRequestFromPrompt } from '../../../../lib/bailianClient'

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const {
        data: { user }
    } = await supabase.auth.getUser()

    if (!user) {
        return NextResponse.json({ error: '未授权，请先登录后再尝试解析旅行需求。' }, { status: 401 })
    }

    let body: any
    try {
        body = await request.json()
    } catch {
        return NextResponse.json({ error: '请求体必须是合法的 JSON。' }, { status: 400 })
    }

    const prompt = typeof body?.prompt === 'string' ? body.prompt.trim() : ''
    if (!prompt) {
        return NextResponse.json({ error: '请提供需要解析的旅行描述。' }, { status: 400 })
    }

    try {
        const data = await extractTripRequestFromPrompt(prompt)
        return NextResponse.json({ data })
    } catch (error) {
        console.error('extractTripRequestFromPrompt failed', error)
        return NextResponse.json({ error: error instanceof Error ? error.message : '解析旅行需求失败。' }, { status: 500 })
    }
}
