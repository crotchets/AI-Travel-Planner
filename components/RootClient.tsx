"use client"
import React from 'react'
import AuthProvider from './AuthProvider'
import Nav from './Nav'

export default function RootClient({ children }: { children: React.ReactNode }) {
    return (
        <AuthProvider>
            <div className="min-h-screen flex flex-col">
                <header className="bg-white shadow-sm">
                    <div className="container mx-auto px-4 py-4 flex items-center justify-between">
                        <h1 className="text-lg font-semibold">AI Travel Planner</h1>
                        <Nav />
                    </div>
                </header>
                <main className="container mx-auto px-4 py-6 flex-1">{children}</main>
            </div>
        </AuthProvider>
    )
}
