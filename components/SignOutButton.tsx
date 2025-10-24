"use client"
import { useRouter } from 'next/navigation'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from './AuthProvider'

export default function SignOutButton() {
    const router = useRouter()
    const { setUserState } = useAuth()

    async function signOut() {
        try {
            await supabase.auth.signOut()
        } catch (err) {
            console.error('signOut error', err)
        }

        // Ensure client state is cleared immediately
        try {
            setUserState(null)
        } catch (e) {
            // ignore
        }

        // Also tell the server to clear any server-side session cookie
        try {
            await fetch('/api/auth/signout', { method: 'POST' })
        } catch (e) {
            // ignore
        }

        router.replace('/auth')
    }

    return (
        <button onClick={signOut} className="px-3 py-1 bg-red-600 text-white rounded">登出</button>
    )
}
