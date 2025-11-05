import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
    const supabase = createRouteHandlerClient({ cookies })
    const { event, session } = await request.json()

    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        await supabase.auth.setSession(session)
    }

    if (event === 'SIGNED_OUT') {
        await supabase.auth.signOut()
    }

    return NextResponse.json({ success: true })
}
