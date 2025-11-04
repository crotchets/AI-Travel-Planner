"use client"
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import SignOutButton from './SignOutButton'

export default function Nav() {
    const { user } = useAuth()

    return (
        <nav className="flex items-center gap-5 text-sm font-medium text-slate-700 md:text-base">
            <Link href="/dashboard" className="transition hover:text-indigo-500">仪表盘</Link>
            <Link href="/itineraries" className="transition hover:text-indigo-500">行程</Link>
            <Link href="/budget" className="transition hover:text-indigo-500">预算</Link>
            <Link href="/settings" className="transition hover:text-indigo-500">设置</Link>
            <div className="ml-2 flex items-center gap-3">
                {user ? (
                    <>
                        <span className="hidden text-xs text-slate-500 sm:inline md:text-sm">{user.email}</span>
                        <SignOutButton />
                    </>
                ) : (
                    <Link href="/auth" className="rounded-full border border-indigo-200 px-3 py-1 text-xs font-semibold text-indigo-500 transition hover:border-indigo-400 hover:bg-indigo-50 sm:text-sm">
                        登录
                    </Link>
                )}
            </div>
        </nav>
    )
}
