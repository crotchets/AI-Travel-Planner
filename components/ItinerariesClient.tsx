"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from './AuthProvider'
import ItineraryDetailDialog from './ItineraryDetailDialog'
import type { TripPlan, TripPlanRecord, TripRequest } from '../types/trip'

interface ApiResponse<T> {
    data?: T
    error?: string
}

export default function ItinerariesClient() {
    const { user } = useAuth()
    const [plans, setPlans] = useState<TripPlanRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editPlanJson, setEditPlanJson] = useState('')
    const [editRequestJson, setEditRequestJson] = useState('')
    const [editError, setEditError] = useState<string | null>(null)
    const [editSubmitting, setEditSubmitting] = useState(false)

    const [detailPlan, setDetailPlan] = useState<TripPlanRecord | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)

    const loadPlans = useCallback(async () => {
        if (!user) return
        setIsLoading(true)
        setError(null)
        try {
            const response = await fetch('/api/itineraries', { method: 'GET' })
            const payload = (await response.json()) as ApiResponse<TripPlanRecord[]>
            if (!response.ok) {
                throw new Error(payload.error || '加载行程失败。')
            }
            setPlans(payload.data ?? [])
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : '加载行程失败。')
        } finally {
            setIsLoading(false)
        }
    }, [user])

    useEffect(() => {
        void loadPlans()
    }, [loadPlans])

    const activeDetailPlan = useMemo(() => {
        if (!detailPlan) return null
        return plans.find(item => item.id === detailPlan.id) ?? detailPlan
    }, [detailPlan, plans])

    useEffect(() => {
        if (detailOpen || !detailPlan) return
        const timer = window.setTimeout(() => setDetailPlan(null), 240)
        return () => window.clearTimeout(timer)
    }, [detailOpen, detailPlan])

    const beginEdit = useCallback((record: TripPlanRecord) => {
        setEditingId(record.id)
        setEditPlanJson(JSON.stringify({
            city: record.city,
            start_date: record.start_date,
            end_date: record.end_date,
            days: record.days,
            weather_info: record.weather_info,
            overall_suggestions: record.overall_suggestions,
            budget: record.budget ?? undefined
        }, null, 2))
        setEditRequestJson(record.request ? JSON.stringify(record.request, null, 2) : '')
        setEditError(null)
    }, [])

    const cancelEdit = useCallback(() => {
        setEditingId(null)
        setEditPlanJson('')
        setEditRequestJson('')
        setEditError(null)
    }, [])

    const handleUpdate = useCallback(async () => {
        if (!user || !editingId) {
            setEditError('未选择要更新的行程或未登录。')
            return
        }
        setEditSubmitting(true)
        setEditError(null)
        try {
            const plan = JSON.parse(editPlanJson) as TripPlan
            const request = editRequestJson.trim() ? (JSON.parse(editRequestJson) as TripRequest) : null

            const response = await fetch(`/api/itineraries/${editingId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, request })
            })
            const payload = (await response.json()) as ApiResponse<TripPlanRecord>

            if (!response.ok) {
                throw new Error(payload.error || '更新行程失败。')
            }
            if (!payload.data) {
                throw new Error('未返回更新后的行程。')
            }

            const updated = payload.data
            setPlans(prev => prev.map(item => (item.id === updated.id ? updated : item)))
            cancelEdit()
        } catch (err) {
            console.error(err)
            setEditError(err instanceof Error ? err.message : '更新行程失败，请检查 JSON 格式。')
        } finally {
            setEditSubmitting(false)
        }
    }, [cancelEdit, editPlanJson, editRequestJson, editingId, user])

    const openDetail = useCallback((plan: TripPlanRecord) => {
        setDetailPlan(plan)
        setDetailOpen(true)
    }, [])

    const closeDetail = useCallback(() => {
        setDetailOpen(false)
    }, [])

    const planSummary = useCallback((plan: TripPlanRecord) => {
        const dayCount = plan.days.length
        const attractions = plan.days.reduce((total, day) => total + day.attractions.length, 0)
        return `${dayCount} 天 · ${attractions} 个景点`
    }, [])

    const headerDescription = useMemo(() => {
        if (!user) {
            return '登录后可查看并管理属于你的行程规划。'
        }
        if (isLoading) {
            return '正在加载行程，请稍候…'
        }
        if (plans.length === 0) {
            return '暂无行程，请前往仪表盘使用 AI 表单创建新的 TripPlan。'
        }
        return `已保存 ${plans.length} 条行程，可点击卡片查看详情或编辑。`
    }, [isLoading, plans.length, user])

    return (
        <>
            <div className="space-y-8">
                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-xl font-semibold text-slate-900">我的行程</h2>
                        <p className="mt-1 text-sm text-slate-500">{headerDescription}</p>
                    </header>

                    {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

                    {isLoading ? (
                        <p className="text-sm text-slate-500">正在加载行程列表…</p>
                    ) : plans.length === 0 ? (
                        <div className="space-y-3 text-sm text-slate-500">
                            <p>暂无行程记录。请在仪表盘的“创建新行程”表单中生成 TripPlan。</p>
                            <a
                                href="/"
                                className="inline-flex rounded-full border border-blue-500 px-4 py-2 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                            >
                                前往仪表盘
                            </a>
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {plans.map(plan => (
                                <li
                                    key={plan.id}
                                    id={plan.id}
                                    className="rounded-lg border border-slate-200 p-4 shadow-sm"
                                >
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div>
                                            <h3 className="text-lg font-semibold text-slate-900">
                                                {plan.city} · {plan.start_date} - {plan.end_date}
                                            </h3>
                                            <p className="text-xs text-slate-500">{planSummary(plan)}</p>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-slate-500">
                                            <span>
                                                创建时间：{new Date(plan.created_at).toLocaleString('zh-CN', { hour12: false })}
                                            </span>
                                            {plan.updated_at ? (
                                                <span>
                                                    最近更新：{new Date(plan.updated_at).toLocaleString('zh-CN', { hour12: false })}
                                                </span>
                                            ) : null}
                                            <button
                                                type="button"
                                                onClick={() => openDetail(plan)}
                                                className="rounded-full border border-emerald-500 px-3 py-1 text-xs font-medium text-emerald-600 transition hover:bg-emerald-50"
                                            >
                                                查看详情
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => beginEdit(plan)}
                                                className="rounded-full border border-blue-500 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                                            >
                                                编辑
                                            </button>
                                        </div>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-600">{plan.overall_suggestions}</p>

                                    {editingId === plan.id ? (
                                        <div className="mt-4 space-y-3 rounded-lg border border-blue-200 bg-blue-50/40 p-4">
                                            <h4 className="text-sm font-semibold text-blue-700">编辑 TripPlan JSON</h4>
                                            <label className="block text-xs font-medium text-blue-700">TripPlan</label>
                                            <textarea
                                                value={editPlanJson}
                                                onChange={event => setEditPlanJson(event.target.value)}
                                                rows={12}
                                                className="w-full rounded border border-blue-200 bg-white p-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            />
                                            <label className="block text-xs font-medium text-blue-700">TripRequest（可选）</label>
                                            <textarea
                                                value={editRequestJson}
                                                onChange={event => setEditRequestJson(event.target.value)}
                                                rows={6}
                                                className="w-full rounded border border-blue-200 bg-white p-2 font-mono text-xs text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                placeholder="{}"
                                            />
                                            {editError ? (
                                                <p className="text-xs text-red-600">{editError}</p>
                                            ) : null}
                                            <div className="flex flex-wrap gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleUpdate}
                                                    disabled={editSubmitting}
                                                    className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                                                >
                                                    {editSubmitting ? '保存中…' : '保存修改'}
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={cancelEdit}
                                                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400"
                                                >
                                                    取消
                                                </button>
                                            </div>
                                        </div>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </section>
            </div>
            <ItineraryDetailDialog open={detailOpen} plan={activeDetailPlan} onClose={closeDetail} />
        </>
    )
}
