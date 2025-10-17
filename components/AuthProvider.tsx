"use client"
import React, { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'

type User = any | null

const AuthContext = createContext<{ user: User; setUser: (u: User) => void } | undefined>(undefined)

export default function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User>(null)

    useEffect(() => {
        let mounted = true
        supabase.auth.getSession().then(res => {
            if (!mounted) return
            setUser(res.data.session?.user ?? null)
        })

        const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null)
        })

        return () => {
            mounted = false
            sub?.subscription?.unsubscribe()
        }
    }, [])

    return <AuthContext.Provider value={{ user, setUser }}>{children}</AuthContext.Provider>
}

export function useAuth() {
    const ctx = useContext(AuthContext)
    if (!ctx) throw new Error('useAuth must be used within AuthProvider')
    return ctx
}
