"use client"
import Link from 'next/link'
import { useAuth } from './AuthProvider'
import ItineraryInputForm from './ItineraryInputForm'

export default function DashboardClient() {
    const { user } = useAuth()

    return (
        <div className="space-y-6">
            <header>
                <h2 className="text-2xl font-bold text-slate-900">仪表盘</h2>
                {user ? <p className="mt-1 text-sm text-slate-500">欢迎回来，{user.email}</p> : null}
            </header>

            {user ? (
                <>
                    <ItineraryInputForm
                        onSubmit={async payload => {
                            // TODO: 调用后端行程规划接口
                            console.log('submit planning request', payload)
                        }}
                    />

                    <section className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                        行程规划结果与历史记录将在这里展示。后续可以接 Supabase 数据或调用 LLM 服务生成行程卡片。
                    </section>

                    <div className="flex gap-2">
                        <Link href="/itineraries" className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                            查看我的行程
                        </Link>
                        <Link href="/budget" className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:text-blue-600">
                            管理预算
                        </Link>
                    </div>
                </>
            ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <p className="mb-4 text-sm text-slate-600">请登录后体验 AI 行程规划与预算管理功能。</p>
                    <Link href="/auth" className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700">
                        去登录 / 注册
                    </Link>
                </div>
            )}
        </div>
    )
}
