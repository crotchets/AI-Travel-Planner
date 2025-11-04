"use client"
import React from 'react'
import AuthProvider from './AuthProvider'
import Nav from './Nav'

export default function RootClient({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <div className="flex min-h-screen flex-col">
                <header className="bg-white/90 backdrop-blur border-b border-slate-200">
                    <div className="container mx-auto flex items-center justify-between px-5 py-5 lg:px-8">
                        <h1 className="text-xl font-bold tracking-tight text-slate-900 lg:text-2xl">AI Travel Planner</h1>
                        <Nav />
                    </div>
                </header>
                <main className="flex-1 w-full">{children}</main>
            </div>
        </AuthProvider>
    )
}
