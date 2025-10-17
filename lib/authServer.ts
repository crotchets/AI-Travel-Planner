// server-side auth helper (placeholder)
import { createServerComponentClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

// Server-side helper to get the current Supabase session.
// If environment variables are not set, this helper returns null instead of throwing,
// so pages can still render locally without Supabase configured.
export async function getServerSession(req?: any) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!url || !key) {
        // Environment not configured yet — return null session so callers can handle redirect/guest flow.
        // NOTE: For real auth you should set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local
        return null
    }

    const supabase = createServerComponentClient({ cookies }, { supabaseUrl: url, supabaseKey: key })
    const { data } = await supabase.auth.getSession()
    return data.session
}
