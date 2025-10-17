"use client"
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import SignOutButton from './SignOutButton'

export default function Nav() {
    const { user } = useAuth()

    return (
        <nav className="flex gap-3 items-center">
            <Link href="/dashboard" className="text-sm text-gray-700">仪表盘</Link>
            <Link href="/itineraries" className="text-sm text-gray-700">行程</Link>
            <Link href="/budget" className="text-sm text-gray-700">预算</Link>
            <Link href="/settings" className="text-sm text-gray-700">设置</Link>
            <div className="ml-4">
                {user ? (
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-700">{user.email}</span>
                        <SignOutButton />
                    </div>
                ) : (
                    <Link href="/auth" className="text-sm text-blue-600">登录</Link>
                )}
            </div>
        </nav>
    )
}
