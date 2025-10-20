"use client"
import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient'

type AuthStatus = 'loading' | 'authenticated' | 'unauthenticated'
type AuthUser = any | null

type AuthContextValue = {
    user: AuthUser
    status: AuthStatus
    setUserState: (user: AuthUser) => void
    refresh: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser>(null)
    const [status, setStatus] = useState<AuthStatus>('loading')

    const setUserState = useCallback((nextUser: AuthUser) => {
        setUser(nextUser)
        setStatus(nextUser ? 'authenticated' : 'unauthenticated')
    }, [])

    const refresh = useCallback(async () => {
        setStatus('loading')
        try {
            const { data, error } = await supabase.auth.getSession()
            if (error) {
                console.error('auth refresh error', error)
                setUserState(null)
                return
            }
            const sessionUser = data?.session?.user ?? null
            setUserState(sessionUser)
        } catch (err) {
            console.error('auth refresh exception', err)
            setUserState(null)
        }
    }, [setUserState])

    useEffect(() => {
        let cancelled = false

        refresh()

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (cancelled) return
            const nextUser = session?.user ?? null
            setUserState(nextUser)
        })

        return () => {
            cancelled = true
            data?.subscription?.unsubscribe()
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [refresh, setUserState])

    const value = useMemo<AuthContextValue>(
        () => ({ user, status, setUserState, refresh }),
        [user, status, setUserState, refresh]
    )

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
