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

    const syncSessionWithServer = useCallback(async (event: string, session: any) => {
        try {
            await fetch('/api/auth/callback', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ event, session })
            })
        } catch (error) {
            console.error('sync session failed', error)
        }
    }, [])

    const refresh = useCallback(async () => {
        setStatus('loading')
        try {
            const { data, error } = await supabase.auth.getSession()
            if (error) {
                console.error('auth refresh error', error)
                await syncSessionWithServer('SIGNED_OUT', null)
                setUserState(null)
                return
            }
            const session = data?.session ?? null
            const sessionUser = session?.user ?? null
            await syncSessionWithServer(sessionUser ? 'SIGNED_IN' : 'SIGNED_OUT', session)
            setUserState(sessionUser)
        } catch (err) {
            console.error('auth refresh exception', err)
            await syncSessionWithServer('SIGNED_OUT', null)
            setUserState(null)
        }
    }, [setUserState, syncSessionWithServer])

    useEffect(() => {
        let cancelled = false

        refresh()

        const { data } = supabase.auth.onAuthStateChange((_event, session) => {
            if (cancelled) return
            const nextUser = session?.user ?? null
            setStatus('loading')
            void syncSessionWithServer(_event, session)
                .catch(error => {
                    console.error('sync session onAuthStateChange failed', error)
                })
                .finally(() => {
                    if (!cancelled) {
                        setUserState(nextUser)
                    }
                })
        })

        return () => {
            cancelled = true
            data?.subscription?.unsubscribe()
        }
    }, [refresh, setUserState, syncSessionWithServer])

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
