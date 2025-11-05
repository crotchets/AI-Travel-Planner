"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'

import { useAuth } from './AuthProvider'
import type { TripPlan, TripPlanRecord, TripRequest } from '../types/trip'

const SAMPLE_TRIP_PLAN: TripPlan = {
    city: '东京',
    start_date: '2025-05-01',
    end_date: '2025-05-03',
    days: [
        {
            date: '2025-05-01',
            day_index: 1,
            description: '抵达东京后游览浅草寺与晴空塔。',
            transportation: '地铁 + 步行',
            accommodation: '新宿商务酒店',
            hotel: {
                name: '新宿阳光酒店',
                address: '东京都新宿区歌舞伎町 1-1-1',
                rating: 4.3,
                price_range: '￥800 - ￥1200',
                latitude: 35.6938,
                longitude: 139.7034
            },
            attractions: [
                {
                    name: '浅草寺',
                    description: '东京最古老的寺院，适合感受传统文化。',
                    category: '文化',
                    address: '东京都台东区浅草 2-3-1',
                    latitude: 35.7148,
                    longitude: 139.7967,
                    rating: 4.7,
                    estimated_duration_hours: 2,
                    ticket_price: 0
                },
                {
                    name: '东京晴空塔',
                    description: '登塔俯瞰城市夜景。',
                    category: '观光',
                    address: '东京都墨田区押上一丁目',
                    latitude: 35.7101,
                    longitude: 139.8107,
                    rating: 4.6,
                    estimated_duration_hours: 2,
                    ticket_price: 2100,
                    currency: 'JPY'
                }
            ],
            meals: [
                {
                    name: '上野阿美横丁小吃',
                    type: 'lunch',
                    description: '尝试章鱼烧与日式炸串。',
                    estimated_cost: 1500,
                    currency: 'JPY'
                },
                {
                    name: '筑地寿司晚餐',
                    type: 'dinner',
                    description: '新鲜寿司套餐。',
                    estimated_cost: 4500,
                    currency: 'JPY'
                }
            ]
        },
        {
            date: '2025-05-02',
            day_index: 2,
            description: '探索新宿御苑与秋叶原，安排购物与动漫体验。',
            transportation: 'JR 山手线',
            accommodation: '新宿商务酒店',
            attractions: [
                {
                    name: '新宿御苑',
                    category: '自然',
                    address: '东京都新宿区内藤町 11',
                    latitude: 35.6852,
                    longitude: 139.71,
                    rating: 4.6,
                    estimated_duration_hours: 3,
                    ticket_price: 500,
                    currency: 'JPY'
                },
                {
                    name: '秋叶原电器街',
                    category: '购物',
                    address: '东京都千代田区外神田',
                    latitude: 35.6983,
                    longitude: 139.7731,
                    rating: 4.4,
                    estimated_duration_hours: 3
                }
            ],
            meals: [
                {
                    name: '新宿早餐咖啡',
                    type: 'breakfast',
                    estimated_cost: 1200,
                    currency: 'JPY'
                },
                {
                    name: '秋叶原拉面午餐',
                    type: 'lunch',
                    estimated_cost: 1100,
                    currency: 'JPY'
                },
                {
                    name: '新桥烤肉',
                    type: 'dinner',
                    estimated_cost: 5000,
                    currency: 'JPY'
                }
            ]
        },
        {
            date: '2025-05-03',
            day_index: 3,
            description: '前往台场，体验海滨公园与数码艺术馆后返程。',
            transportation: '百合海鸥线',
            accommodation: '返程日，无住宿',
            attractions: [
                {
                    name: '台场海滨公园',
                    category: '自然',
                    latitude: 35.6285,
                    longitude: 139.7758,
                    rating: 4.5,
                    estimated_duration_hours: 2
                },
                {
                    name: 'teamLab Borderless',
                    category: '艺术',
                    latitude: 35.6258,
                    longitude: 139.7765,
                    rating: 4.6,
                    estimated_duration_hours: 3,
                    ticket_price: 3800,
                    currency: 'JPY'
                }
            ],
            meals: [
                {
                    name: '酒店早餐',
                    type: 'breakfast',
                    estimated_cost: 0
                },
                {
                    name: '台场海鲜午餐',
                    type: 'lunch',
                    estimated_cost: 3200,
                    currency: 'JPY'
                }
            ]
        }
    ],
    weather_info: [
        { date: '2025-05-01', temperature: 22, condition: '晴', wind: '东风 3 级' },
        { date: '2025-05-02', temperature: 21, condition: '多云', wind: '东北风 2 级' },
        { date: '2025-05-03', temperature: 23, condition: '晴', wind: '东南风 3 级' }
    ],
    overall_suggestions: '东京交通便利，可提前购买交通一日券；注意热门景点需预约。',
    budget: {
        total: 4800,
        currency: 'CNY',
        categories: [
            { label: '住宿', amount: 1600 },
            { label: '餐饮', amount: 900 },
            { label: '交通', amount: 700 },
            { label: '景点门票', amount: 900 },
            { label: '购物/其他', amount: 700 }
        ]
    }
}

const SAMPLE_TRIP_REQUEST: TripRequest = {
    city: '东京',
    start_date: '2025-05-01',
    end_date: '2025-05-03',
    travel_days: 3,
    transportation: 'public',
    accommodation: 'boutique',
    preferences: ['美食', '动漫', '城市散步'],
    budget_level: 'moderate',
    free_text_input: '希望安排一天秋叶原购物，热爱动画与电子产品。'
}

const defaultRequestJson = JSON.stringify(SAMPLE_TRIP_REQUEST, null, 2)
const defaultPlanJson = JSON.stringify(SAMPLE_TRIP_PLAN, null, 2)

interface ApiResponse<T> {
    data?: T
    error?: string
}

export default function ItinerariesClient() {
    const { user } = useAuth()
    const [plans, setPlans] = useState<TripPlanRecord[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const [createPlanJson, setCreatePlanJson] = useState(defaultPlanJson)
    const [createRequestJson, setCreateRequestJson] = useState(defaultRequestJson)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [createError, setCreateError] = useState<string | null>(null)

    const [editingId, setEditingId] = useState<string | null>(null)
    const [editPlanJson, setEditPlanJson] = useState('')
    const [editRequestJson, setEditRequestJson] = useState('')
    const [editError, setEditError] = useState<string | null>(null)
    const [editSubmitting, setEditSubmitting] = useState(false)

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

    const handleCreate = useCallback(async () => {
        if (!user) {
            setCreateError('请先登录再创建行程。')
            return
        }
        setIsSubmitting(true)
        setCreateError(null)
        try {
            const plan = JSON.parse(createPlanJson) as TripPlan
            const request = createRequestJson.trim() ? (JSON.parse(createRequestJson) as TripRequest) : null

            const response = await fetch('/api/itineraries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ plan, request })
            })
            const payload = (await response.json()) as ApiResponse<TripPlanRecord>

            if (!response.ok) {
                throw new Error(payload.error || '创建行程失败。')
            }
            if (!payload.data) {
                throw new Error('未返回行程数据。')
            }

            const record = payload.data
            setPlans(prev => [record, ...prev])
            setCreateError(null)
        } catch (err) {
            console.error(err)
            setCreateError(err instanceof Error ? err.message : '创建行程失败，请检查 JSON 格式。')
        } finally {
            setIsSubmitting(false)
        }
    }, [createPlanJson, createRequestJson, user])

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

    const planSummary = useCallback((plan: TripPlanRecord) => {
        const dayCount = plan.days.length
        const attractions = plan.days.reduce((total, day) => total + day.attractions.length, 0)
        return `${dayCount} 天 · ${attractions} 个景点`
    }, [])

    const headerDescription = useMemo(() => {
        if (!user) {
            return '登录后可查看、创建并编辑属于你的行程规划。'
        }
        if (isLoading) {
            return '正在加载行程，请稍候…'
        }
        if (plans.length === 0) {
            return '暂无行程，使用下方表单创建第一个 TripPlan。'
        }
        return `已保存 ${plans.length} 条行程，可点击卡片进行编辑。`
    }, [isLoading, plans.length, user])

    return (
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
                    <p className="text-sm text-slate-500">暂无行程记录。</p>
                ) : (
                    <ul className="space-y-4">
                        {plans.map(plan => (
                            <li key={plan.id} className="rounded-lg border border-slate-200 p-4 shadow-sm">
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

            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <header className="mb-4">
                    <h2 className="text-xl font-semibold text-slate-900">创建新 TripPlan</h2>
                    <p className="mt-1 text-sm text-slate-500">
                        将 TripPlan 完整 JSON 粘贴到下面，系统会验证字段并保存到 Supabase。TripRequest（用户原始需求）为可选。
                    </p>
                </header>

                {createError ? (
                    <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{createError}</p>
                ) : null}

                <div className="space-y-3">
                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        TripPlan JSON
                    </label>
                    <textarea
                        value={createPlanJson}
                        onChange={event => setCreatePlanJson(event.target.value)}
                        rows={16}
                        className="w-full rounded border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800 shadow focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />

                    <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500">
                        TripRequest JSON（可选）
                    </label>
                    <textarea
                        value={createRequestJson}
                        onChange={event => setCreateRequestJson(event.target.value)}
                        rows={8}
                        className="w-full rounded border border-slate-300 bg-slate-50 p-3 font-mono text-xs text-slate-800 shadow focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-200"
                    />

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={handleCreate}
                            disabled={isSubmitting}
                            className="rounded-full bg-green-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-green-300"
                        >
                            {isSubmitting ? '保存中…' : '保存到 Supabase'}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                setCreatePlanJson(defaultPlanJson)
                                setCreateRequestJson(defaultRequestJson)
                                setCreateError(null)
                            }}
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400"
                        >
                            重置示例数据
                        </button>
                    </div>
                </div>
            </section>
        </div>
    )
}
