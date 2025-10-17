"use client"
import Link from 'next/link'
import { useAuth } from './AuthProvider'

export default function DashboardClient() {
    const { user } = useAuth()

    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">仪表盘</h2>
            {user ? (
                <div className="space-y-3">
                    <p>已登录：{user.email}</p>
                    <div className="flex gap-2">
                        <Link href="/itineraries" className="px-3 py-1 bg-blue-600 text-white rounded">查看行程</Link>
                    </div>
                </div>
            ) : (
                <div>
                    <p className="mb-4">未登录</p>
                    <Link href="/auth" className="px-4 py-2 bg-blue-600 text-white rounded">去登录 / 注册</Link>
                </div>
            )}
        </div>
    )
}
