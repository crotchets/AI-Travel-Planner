"use client"
import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from './AuthProvider'

export default function ProtectedClient({ children }: { children: React.ReactNode }) {
    const { user, status } = useAuth()
    const router = useRouter()

    useEffect(() => {
        // Only redirect when我们明确知道用户未登录
        if (status === 'unauthenticated') {
            const next = typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname + window.location.search) : '/'
            router.replace(`/auth?next=${next}`)
        }
    }, [status, router])

    if (status === 'loading') {
        return null
    }

    if (status !== 'authenticated' || !user) {
        return null
    }

    return <>{children}</>
}
