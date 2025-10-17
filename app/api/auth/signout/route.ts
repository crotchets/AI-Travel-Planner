import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST() {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        await supabase.auth.signOut()
        return NextResponse.json({ ok: true })
    } catch (err) {
        return NextResponse.json({ ok: false, error: String(err) }, { status: 500 })
    }
}
