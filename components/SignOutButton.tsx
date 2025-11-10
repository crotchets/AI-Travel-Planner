"use client"
import { useCallback, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'

export default function SignOutButton() {
    const router = useRouter()
    const { setUserState, refresh } = useAuth()
    const [isSigningOut, setIsSigningOut] = useState(false)

    const handleSignOut = useCallback(async () => {
        if (isSigningOut) return
        setIsSigningOut(true)

        try {
            const { error } = await supabase.auth.signOut({ scope: 'global' })
            if (error) {
                throw error
            }

            setUserState(null)

            await fetch('/api/auth/signout', {
                method: 'POST',
                credentials: 'include',
                cache: 'no-store'
            }).catch(() => undefined)

            await refresh().catch(() => undefined)
        } catch (err) {
            console.error('signOut error', err)
        } finally {
            setIsSigningOut(false)
            router.replace('/auth')
            router.refresh()
        }
    }, [isSigningOut, refresh, router, setUserState])

    return (
        <button
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-red-300 sm:text-sm"
        >
            {isSigningOut ? '登出中…' : '登出'}
        </button>
    )
}
