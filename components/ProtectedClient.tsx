"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

export default function ProtectedClient({ children }: { children: React.ReactNode }) {
    const { user } = useAuth()
    const router = useRouter()

    useEffect(() => {
        // If user is explicitly null (known unauthenticated), redirect to /auth
        if (user === null) {
            const next = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : '/'
            router.replace(`/auth?next=${next}`)
        }
    }, [user, router])

    // While user is undefined or null, avoid rendering protected UI.
    // AuthProvider sets null or user; if null we have already redirected; return null to avoid flicker.
    if (!user) return null

    return <>{children}</>
}
