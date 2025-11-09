"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

import { useAuth } from './AuthProvider'
import ItineraryDetailDialog from './ItineraryDetailDialog'
import type { TripPlan, TripPlanRecord, TripRequest } from '../types/trip'

interface ApiResponse<T> {
    data?: T
    error?: string
}

interface PlanFilters {
    search: string
    startDate: string
    endDate: string
}

type SortOption = 'created_desc' | 'created_asc' | 'start_date_desc' | 'start_date_asc'

const DEFAULT_SORT_OPTION: SortOption = 'created_desc'

export default function ItinerariesClient() {
    const { user } = useAuth()
    const router = useRouter()
    const searchParams = useSearchParams()
    const [plans, setPlans] = useState<TripPlanRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [filters, setFilters] = useState<PlanFilters>({ search: '', startDate: '', endDate: '' })
    const [sortOption, setSortOption] = useState<SortOption>(DEFAULT_SORT_OPTION)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editPlanJson, setEditPlanJson] = useState('')
    const [editRequestJson, setEditRequestJson] = useState('')
    const [editError, setEditError] = useState<string | null>(null)
    const [editSubmitting, setEditSubmitting] = useState(false)

    const [detailPlan, setDetailPlan] = useState<TripPlanRecord | null>(null)
    const [detailOpen, setDetailOpen] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const planIdQuery = searchParams?.get('planId') ?? null

    const resetFilters = useCallback(() => {
        setFilters({ search: '', startDate: '', endDate: '' })
        setSortOption(DEFAULT_SORT_OPTION)
    }, [setFilters, setSortOption])

    const updatePlanIdQuery = useCallback(
        (planId: string | null, options: { replace?: boolean } = {}) => {
            const current = searchParams ? new URLSearchParams(searchParams.toString()) : new URLSearchParams()
            if (planId) {
                current.set('planId', planId)
            } else {
                current.delete('planId')
            }
            const queryString = current.toString()
            const href = queryString ? `/itineraries?${queryString}` : '/itineraries'
            if (options.replace) {
                router.replace(href, { scroll: false })
            } else {
                router.push(href, { scroll: false })
            }
        },
        [router, searchParams]
    )

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
        if (!plans.length || !planIdQuery) {
            return
        }
        if (detailPlan?.id === planIdQuery && detailOpen) {
            return
        }
        const target = plans.find(item => item.id === planIdQuery)
        if (target) {
            setDetailPlan(target)
            setDetailOpen(true)
        }
    }, [plans, planIdQuery, detailPlan, detailOpen])

    useEffect(() => {
        if (!planIdQuery && detailOpen) {
            setDetailOpen(false)
        }
    }, [planIdQuery, detailOpen])

    useEffect(() => {
        void loadPlans()
    }, [loadPlans])

    const visiblePlans = useMemo(() => {
        if (!plans.length) {
            return []
        }

        const searchValue = filters.search.trim().toLowerCase()
        const parseDate = (value: string | undefined | null) => {
            if (!value) return null
            const timestamp = Date.parse(value)
            return Number.isNaN(timestamp) ? null : timestamp
        }

        const startTimestamp = filters.startDate ? parseDate(filters.startDate) : null
        const endTimestamp = filters.endDate ? parseDate(filters.endDate) : null

        const filtered = plans.filter(plan => {
            if (searchValue) {
                const haystacks = [plan.city, plan.request?.city, plan.overall_suggestions]
                    .filter(Boolean)
                    .map(text => text!.toLowerCase())
                const matchesSearch = haystacks.some(text => text.includes(searchValue))
                if (!matchesSearch) return false
            }

            const planStart = parseDate(plan.start_date)
            if (startTimestamp !== null && (planStart === null || planStart < startTimestamp)) {
                return false
            }

            const planEnd = parseDate(plan.end_date)
            if (endTimestamp !== null && (planEnd === null || planEnd > endTimestamp)) {
                return false
            }

            return true
        })

        const toTime = (value: string | undefined | null) => {
            if (!value) return 0
            const timestamp = Date.parse(value)
            return Number.isNaN(timestamp) ? 0 : timestamp
        }

        const sorted = [...filtered].sort((a, b) => {
            switch (sortOption) {
                case 'created_asc':
                    return toTime(a.created_at) - toTime(b.created_at)
                case 'start_date_desc': {
                    const diff = toTime(b.start_date) - toTime(a.start_date)
                    return diff !== 0 ? diff : toTime(b.end_date) - toTime(a.end_date)
                }
                case 'start_date_asc': {
                    const diff = toTime(a.start_date) - toTime(b.start_date)
                    return diff !== 0 ? diff : toTime(a.end_date) - toTime(b.end_date)
                }
                case 'created_desc':
                default:
                    return toTime(b.created_at) - toTime(a.created_at)
            }
        })

        return sorted
    }, [filters, plans, sortOption])

    const hasActiveFilters = useMemo(() => {
        const searchActive = filters.search.trim().length > 0
        return Boolean(searchActive || filters.startDate || filters.endDate || sortOption !== DEFAULT_SORT_OPTION)
    }, [filters, sortOption])

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

    const openDetail = useCallback(
        (plan: TripPlanRecord, options?: { replace?: boolean }) => {
            setDetailPlan(plan)
            setDetailOpen(true)
            updatePlanIdQuery(plan.id, { replace: options?.replace })
        },
        [updatePlanIdQuery]
    )

    const closeDetail = useCallback(() => {
        setDetailOpen(false)
        updatePlanIdQuery(null, { replace: true })
    }, [updatePlanIdQuery])

    const handleDelete = useCallback(
        async (plan: TripPlanRecord) => {
            if (!user) {
                setError('未授权，请先登录。')
                return
            }

            const confirmed = window.confirm(`确定要删除行程「${plan.city} · ${plan.start_date} - ${plan.end_date}」吗？该操作无法撤销。`)
            if (!confirmed) return

            setDeletingId(plan.id)
            setError(null)
            try {
                const response = await fetch(`/api/itineraries/${plan.id}`, { method: 'DELETE' })
                if (!response.ok) {
                    const payload = (await response.json()) as ApiResponse<null>
                    throw new Error(payload.error || '删除行程失败。')
                }

                setPlans(prev => prev.filter(item => item.id !== plan.id))

                if (editingId === plan.id) {
                    cancelEdit()
                }

                if (detailPlan?.id === plan.id) {
                    setDetailOpen(false)
                    setDetailPlan(null)
                    updatePlanIdQuery(null, { replace: true })
                }
            } catch (err) {
                console.error(err)
                setError(err instanceof Error ? err.message : '删除行程失败。')
            } finally {
                setDeletingId(null)
            }
        },
        [user, cancelEdit, detailPlan, editingId, updatePlanIdQuery]
    )

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
        if (visiblePlans.length === 0) {
            return `共保存 ${plans.length} 条行程，当前筛选条件下没有匹配结果。`
        }
        if (hasActiveFilters) {
            return `共保存 ${plans.length} 条行程，当前显示 ${visiblePlans.length} 条，可继续点击卡片查看详情或编辑。`
        }
        return `已保存 ${plans.length} 条行程，可点击卡片查看详情或编辑。`
    }, [hasActiveFilters, isLoading, plans.length, user, visiblePlans.length])

    return (
        <>
            <div className="space-y-8">
                <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                    <header className="mb-4">
                        <h2 className="text-xl font-semibold text-slate-900">我的行程</h2>
                        <p className="mt-1 text-sm text-slate-500">{headerDescription}</p>
                    </header>

                    {error ? <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}

                    <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                        <label className="flex flex-col text-xs font-semibold text-slate-600">
                            <span className="mb-1 uppercase tracking-wide text-slate-500">目的地 / 关键词</span>
                            <input
                                type="text"
                                value={filters.search}
                                onChange={event =>
                                    setFilters(prev => ({
                                        ...prev,
                                        search: event.target.value
                                    }))
                                }
                                placeholder="输入城市或摘要"
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={isLoading}
                            />
                        </label>
                        <label className="flex flex-col text-xs font-semibold text-slate-600">
                            <span className="mb-1 uppercase tracking-wide text-slate-500">开始日期 ≥</span>
                            <input
                                type="date"
                                value={filters.startDate}
                                onChange={event =>
                                    setFilters(prev => ({
                                        ...prev,
                                        startDate: event.target.value
                                    }))
                                }
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={isLoading}
                            />
                        </label>
                        <label className="flex flex-col text-xs font-semibold text-slate-600">
                            <span className="mb-1 uppercase tracking-wide text-slate-500">结束日期 ≤</span>
                            <input
                                type="date"
                                value={filters.endDate}
                                onChange={event =>
                                    setFilters(prev => ({
                                        ...prev,
                                        endDate: event.target.value
                                    }))
                                }
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={isLoading}
                            />
                        </label>
                        <label className="flex flex-col text-xs font-semibold text-slate-600">
                            <span className="mb-1 uppercase tracking-wide text-slate-500">排序方式</span>
                            <select
                                value={sortOption}
                                onChange={event => setSortOption(event.target.value as SortOption)}
                                className="h-10 rounded-lg border border-slate-200 px-3 text-sm font-normal text-slate-700 shadow-sm transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                disabled={isLoading}
                            >
                                <option value="created_desc">按创建时间（最新在前）</option>
                                <option value="created_asc">按创建时间（最早在前）</option>
                                <option value="start_date_desc">按出行日期（最晚出发在前）</option>
                                <option value="start_date_asc">按出行日期（最早出发在前）</option>
                            </select>
                        </label>
                        <div className="flex items-end">
                            <button
                                type="button"
                                onClick={resetFilters}
                                disabled={!hasActiveFilters}
                                className="h-10 w-full rounded-full border border-slate-300 px-4 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300"
                            >
                                重置筛选
                            </button>
                        </div>
                    </div>

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
                    ) : visiblePlans.length === 0 ? (
                        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50/60 p-6 text-sm text-slate-500">
                            <p>当前筛选条件下没有匹配的行程，可以调整筛选项或点击上方“重置筛选”。</p>
                            {hasActiveFilters ? (
                                <button
                                    type="button"
                                    onClick={resetFilters}
                                    className="rounded-full border border-slate-300 px-4 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-800"
                                >
                                    清除筛选
                                </button>
                            ) : null}
                        </div>
                    ) : (
                        <ul className="space-y-4">
                            {visiblePlans.map(plan => (
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
                                                onClick={() => openDetail(plan, { replace: true })}
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
                                            <button
                                                type="button"
                                                onClick={() => handleDelete(plan)}
                                                disabled={deletingId === plan.id}
                                                className="rounded-full border border-red-500 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-300 disabled:text-red-300"
                                            >
                                                {deletingId === plan.id ? '删除中…' : '删除'}
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
