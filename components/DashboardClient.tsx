"use client"
import Link from 'next/link'
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent
} from 'react'
import { useAuth } from './AuthProvider'
import ItineraryInputForm from './ItineraryInputForm'
import type { TripPlanRecord } from '../types/trip'

const MIN_RATIO = 0.35
const MAX_RATIO = 0.75

function formatDateDisplay(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return new Intl.DateTimeFormat('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

function formatDateTimeDisplay(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return new Intl.DateTimeFormat('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false
    }).format(date)
}

function formatCurrency(amount: number | undefined, currency = 'CNY') {
    if (typeof amount !== 'number' || Number.isNaN(amount)) {
        return null
    }
    try {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency,
            maximumFractionDigits: 0
        }).format(amount)
    } catch {
        return `${amount}${currency ? ` ${currency}` : ''}`
    }
}

export default function DashboardClient() {
    const { user } = useAuth()
    const containerRef = useRef<HTMLDivElement>(null)
    const isDraggingRef = useRef(false)
    const [panelRatio, setPanelRatio] = useState(0.6)
    const [recentPlans, setRecentPlans] = useState<TripPlanRecord[]>([])
    const [isLoadingPlans, setIsLoadingPlans] = useState(false)
    const [plansError, setPlansError] = useState<string | null>(null)
    const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null)

    const fetchRecentPlans = useCallback(async () => {
        if (!user) {
            setRecentPlans([])
            setPlansError(null)
            setIsLoadingPlans(false)
            setSelectedPlanId(null)
            return
        }
        setIsLoadingPlans(true)
        setPlansError(null)
        try {
            const response = await fetch('/api/itineraries?limit=3', { method: 'GET' })
            const payload = await response.json()
            if (!response.ok) {
                throw new Error(payload?.error || '获取行程失败。')
            }
            const list = Array.isArray(payload?.data) ? (payload.data as TripPlanRecord[]) : []
            setRecentPlans(list.slice(0, 3))
        } catch (err) {
            console.error(err)
            setPlansError(err instanceof Error ? err.message : '加载行程时出现问题。')
        } finally {
            setIsLoadingPlans(false)
        }
    }, [user])

    useEffect(() => {
        void fetchRecentPlans()
    }, [fetchRecentPlans])

    useEffect(() => {
        if (recentPlans.length === 0) {
            setSelectedPlanId(null)
            return
        }
        setSelectedPlanId(prev => {
            if (prev && recentPlans.some(plan => plan.id === prev)) {
                return prev
            }
            return recentPlans[0]?.id ?? null
        })
    }, [recentPlans])

    const clampRatio = useCallback((value: number) => {
        return Math.min(MAX_RATIO, Math.max(MIN_RATIO, value))
    }, [])

    const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!containerRef.current) return
        isDraggingRef.current = true
        try {
            event.currentTarget.setPointerCapture(event.pointerId)
        } catch (error) {
            console.warn('setPointerCapture failed', error)
        }
    }, [])

    const handlePointerMove = useCallback(
        (event: ReactPointerEvent<HTMLDivElement>) => {
            if (!isDraggingRef.current || !containerRef.current) return
            const rect = containerRef.current.getBoundingClientRect()
            if (rect.width === 0) return
            const relativePosition = (event.clientX - rect.left) / rect.width
            const nextRatio = clampRatio(relativePosition)
            setPanelRatio(prev => (Math.abs(prev - nextRatio) > 0.001 ? nextRatio : prev))
        },
        [clampRatio]
    )

    const finalizeDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
        if (!isDraggingRef.current) return
        isDraggingRef.current = false
        try {
            event.currentTarget.releasePointerCapture(event.pointerId)
        } catch {
            // ignore
        }
    }, [])

    const handleKeyDown = useCallback(
        (event: ReactKeyboardEvent<HTMLDivElement>) => {
            if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
            event.preventDefault()
            const delta = event.key === 'ArrowLeft' ? -0.02 : 0.02
            setPanelRatio(prev => clampRatio(prev + delta))
        },
        [clampRatio]
    )

    const containerStyle = useMemo(() => {
        const leftPercent = `${(panelRatio * 100).toFixed(2)}%`
        const rightPercent = `${((1 - panelRatio) * 100).toFixed(2)}%`
        return {
            '--panel-left': leftPercent,
            '--panel-right': rightPercent
        } as CSSProperties
    }, [panelRatio])

    const selectedPlan = useMemo(() => {
        if (!selectedPlanId) {
            return null
        }
        return recentPlans.find(plan => plan.id === selectedPlanId) ?? null
    }, [recentPlans, selectedPlanId])

    return (
        <div
            ref={containerRef}
            style={containerStyle}
            className="space-y-6 lg:grid lg:items-start lg:gap-6 lg:space-y-0 lg:[grid-template-columns:minmax(0,var(--panel-left))_minmax(20px,3rem)_minmax(320px,var(--panel-right))]"
        >
            <div className="space-y-6">
                <header>
                    <h2 className="text-2xl font-bold text-slate-900">仪表盘</h2>
                    {user ? <p className="mt-1 text-sm text-slate-500">欢迎回来，{user.email}</p> : null}
                </header>

                {user ? (
                    <>
                        <ItineraryInputForm
                            onPlanCreated={record => {
                                setRecentPlans(prev => {
                                    const merged = [record, ...prev.filter(item => item.id !== record.id)]
                                    return merged.slice(0, 3)
                                })
                                setSelectedPlanId(record.id)
                                void fetchRecentPlans()
                            }}
                        />

                        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                            <header className="mb-4">
                                <h3 className="text-lg font-semibold text-slate-900">最近生成的行程</h3>
                                <p className="mt-1 text-sm text-slate-500">
                                    成功提交后会自动保存到 Supabase，可在这里快速预览最新的 TripPlan。
                                </p>
                            </header>

                            {plansError ? (
                                <p className="rounded bg-red-50 px-3 py-2 text-sm text-red-600">{plansError}</p>
                            ) : null}

                            {isLoadingPlans ? (
                                <p className="text-sm text-slate-500">正在加载最近的行程…</p>
                            ) : recentPlans.length === 0 ? (
                                <p className="text-sm text-slate-500">
                                    目前还没有保存的行程。填写上方表单生成第一个 TripPlan 吧。
                                </p>
                            ) : (
                                <ul className="space-y-3 text-sm text-slate-600">
                                    {recentPlans.map(plan => {
                                        const isSelected = selectedPlan?.id === plan.id
                                        return (
                                            <li
                                                key={plan.id}
                                                tabIndex={0}
                                                role="button"
                                                onClick={() => setSelectedPlanId(plan.id)}
                                                onKeyDown={event => {
                                                    if (event.key === 'Enter' || event.key === ' ') {
                                                        event.preventDefault()
                                                        setSelectedPlanId(plan.id)
                                                    }
                                                }}
                                                className={`rounded-lg border p-4 shadow-sm transition focus:outline-none focus:ring-2 focus:ring-blue-300 ${isSelected
                                                        ? 'border-blue-500 bg-blue-50/60 shadow-md'
                                                        : 'border-slate-200 hover:border-blue-300 hover:shadow-md'
                                                    }`}
                                            >
                                                <div className="flex flex-wrap items-start justify-between gap-2">
                                                    <div>
                                                        <p className="text-sm font-semibold text-slate-900">
                                                            {plan.city} · {formatDateDisplay(plan.start_date)} - {formatDateDisplay(plan.end_date)}
                                                        </p>
                                                        <p className="text-xs text-slate-500">
                                                            更新于 {formatDateTimeDisplay(plan.updated_at ?? plan.created_at)}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        {isSelected ? (
                                                            <span className="rounded-full bg-blue-100 px-2 py-1 text-[11px] font-medium text-blue-600">正在查看</span>
                                                        ) : null}
                                                        <Link
                                                            href={`/itineraries#${plan.id}`}
                                                            onClick={event => event.stopPropagation()}
                                                            className="rounded-full border border-blue-500 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                                                        >
                                                            在页面中打开
                                                        </Link>
                                                    </div>
                                                </div>
                                                <p className="mt-2 line-clamp-3 text-xs text-slate-500">
                                                    {plan.overall_suggestions}
                                                </p>
                                            </li>
                                        )
                                    })}
                                </ul>
                            )}

                            <div className="mt-4 flex justify-end">
                                <Link
                                    href="/itineraries"
                                    className="inline-flex items-center rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-blue-400 hover:text-blue-600"
                                >
                                    查看全部行程
                                </Link>
                            </div>
                        </section>

                        <div className="flex gap-2">
                            <Link
                                href="/itineraries"
                                className="rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                            >
                                查看我的行程
                            </Link>
                            <Link
                                href="/budget"
                                className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:text-blue-600"
                            >
                                管理预算
                            </Link>
                        </div>
                    </>
                ) : (
                    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                        <p className="mb-4 text-sm text-slate-600">请登录后体验 AI 行程规划与预算管理功能。</p>
                        <Link
                            href="/auth"
                            className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
                        >
                            去登录 / 注册
                        </Link>
                    </div>
                )}
            </div>

            <div
                role="separator"
                aria-label="拖动调整地图显示宽度"
                aria-orientation="vertical"
                aria-valuemin={Math.round(MIN_RATIO * 100)}
                aria-valuemax={Math.round(MAX_RATIO * 100)}
                aria-valuenow={Math.round(panelRatio * 100)}
                tabIndex={0}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={finalizeDrag}
                onPointerCancel={finalizeDrag}
                onKeyDown={handleKeyDown}
                className="hidden select-none lg:flex lg:flex-col lg:items-center lg:justify-center"
            >
                <div className="flex h-full flex-col items-center justify-center gap-4">
                    <span className="text-[10px] font-medium uppercase tracking-[0.35em] text-slate-400">Drag</span>
                    <div className="flex h-40 w-10 flex-col items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/70 shadow-sm backdrop-blur">
                        <div className="h-16 w-[3px] rounded-full bg-slate-300" />
                    </div>
                </div>
            </div>

            <aside className="space-y-4 lg:sticky lg:top-24">
                {selectedPlan ? (
                    <div className="space-y-4">
                        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
                            <header className="space-y-2">
                                <p className="text-xs uppercase tracking-[0.35em] text-blue-500/70">当前行程</p>
                                <h3 className="text-xl font-semibold text-slate-900">
                                    {selectedPlan.city} · {formatDateDisplay(selectedPlan.start_date)} - {formatDateDisplay(selectedPlan.end_date)}
                                </h3>
                                <p className="text-sm text-slate-500">
                                    共 {selectedPlan.days.length} 天行程 · 保存于 {formatDateTimeDisplay(selectedPlan.updated_at ?? selectedPlan.created_at)}
                                </p>
                            </header>
                            <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                                {selectedPlan.overall_suggestions}
                            </p>
                        </section>

                        {selectedPlan.weather_info.length > 0 ? (
                            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                <h4 className="text-sm font-semibold text-slate-900">天气预报</h4>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {selectedPlan.weather_info.map(item => (
                                        <div
                                            key={`${item.date}-${item.condition}`}
                                            className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600"
                                        >
                                            <p className="text-sm font-medium text-slate-900">{formatDateDisplay(item.date)}</p>
                                            <p className="mt-1 text-slate-500">{item.condition}</p>
                                            <p className="mt-1 text-slate-500">温度：{item.temperature}°C</p>
                                            {item.wind ? <p className="mt-1 text-slate-400">风速：{item.wind}</p> : null}
                                            {typeof item.humidity === 'number' ? (
                                                <p className="mt-1 text-slate-400">湿度：{item.humidity}%</p>
                                            ) : null}
                                        </div>
                                    ))}
                                </div>
                            </section>
                        ) : null}

                        {selectedPlan.budget ? (
                            <section className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
                                <header className="flex flex-wrap items-center justify-between gap-2">
                                    <h4 className="text-sm font-semibold text-emerald-900">预算概览</h4>
                                    {formatCurrency(selectedPlan.budget.total, selectedPlan.budget.currency ?? 'CNY') ? (
                                        <span className="text-sm font-medium text-emerald-700">
                                            {formatCurrency(selectedPlan.budget.total, selectedPlan.budget.currency ?? 'CNY')}
                                        </span>
                                    ) : null}
                                </header>
                                {selectedPlan.budget.notes ? (
                                    <p className="mt-2 text-xs text-emerald-700/80">{selectedPlan.budget.notes}</p>
                                ) : null}
                                {selectedPlan.budget.categories.length > 0 ? (
                                    <ul className="mt-3 space-y-2 text-xs text-emerald-800">
                                        {selectedPlan.budget.categories.map(category => (
                                            <li key={`${category.label}-${category.amount}`} className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">
                                                <span>{category.label}</span>
                                                <span>
                                                    {formatCurrency(category.amount, category.currency ?? selectedPlan.budget?.currency ?? 'CNY') ?? category.amount}
                                                </span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : null}
                            </section>
                        ) : null}

                        <section className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                            <header>
                                <h4 className="text-sm font-semibold text-slate-900">每日行程</h4>
                                <p className="mt-1 text-xs text-slate-500">包含交通、住宿、景点与餐饮安排</p>
                            </header>

                            <div className="space-y-4">
                                {selectedPlan.days.map(day => (
                                    <article key={`${day.day_index}-${day.date}`} className="rounded-xl border border-slate-100 bg-slate-50/80 p-4 text-sm text-slate-600">
                                        <header className="flex flex-wrap items-center justify-between gap-2 text-slate-700">
                                            <div>
                                                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                                    第 {day.day_index} 天 · {formatDateDisplay(day.date)}
                                                </p>
                                                {day.description ? <p className="mt-1 text-sm text-slate-700">{day.description}</p> : null}
                                            </div>
                                            {day.transportation ? (
                                                <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-600">
                                                    {day.transportation}
                                                </span>
                                            ) : null}
                                        </header>

                                        {day.hotel ? (
                                            <div className="mt-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                                <p className="font-medium text-slate-800">住宿：{day.hotel.name}</p>
                                                {day.hotel.address ? <p className="mt-1 text-slate-500">地址：{day.hotel.address}</p> : null}
                                                {day.hotel.price_range ? (
                                                    <p className="mt-1 text-slate-500">价格区间：{day.hotel.price_range}</p>
                                                ) : null}
                                            </div>
                                        ) : day.accommodation ? (
                                            <p className="mt-3 rounded-lg bg-white px-3 py-2 text-xs text-slate-600">住宿：{day.accommodation}</p>
                                        ) : null}

                                        {day.attractions.length > 0 ? (
                                            <div className="mt-3 space-y-2">
                                                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">景点安排</h5>
                                                <ul className="space-y-2">
                                                    {day.attractions.map((attraction, index) => (
                                                        <li key={`${attraction.name}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                                            <p className="font-medium text-slate-800">{attraction.name}</p>
                                                            {attraction.category ? <p className="mt-1 text-slate-500">类型：{attraction.category}</p> : null}
                                                            {attraction.description ? (
                                                                <p className="mt-1 text-slate-500">{attraction.description}</p>
                                                            ) : null}
                                                            {typeof attraction.estimated_duration_hours === 'number' ? (
                                                                <p className="mt-1 text-slate-500">建议停留 {attraction.estimated_duration_hours} 小时</p>
                                                            ) : null}
                                                            {typeof attraction.ticket_price === 'number' ? (
                                                                <p className="mt-1 text-slate-500">
                                                                    门票：
                                                                    {formatCurrency(
                                                                        attraction.ticket_price,
                                                                        attraction.currency ?? selectedPlan.budget?.currency ?? 'CNY'
                                                                    ) ?? `${attraction.ticket_price}${attraction.currency ? ` ${attraction.currency}` : ''}`}
                                                                </p>
                                                            ) : null}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : null}

                                        {day.meals.length > 0 ? (
                                            <div className="mt-3 space-y-2">
                                                <h5 className="text-xs font-semibold uppercase tracking-wide text-slate-500">餐饮推荐</h5>
                                                <ul className="space-y-2">
                                                    {day.meals.map((meal, index) => (
                                                        <li key={`${meal.name}-${index}`} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                                                            <p className="font-medium text-slate-800">{meal.type} · {meal.name}</p>
                                                            {meal.description ? <p className="mt-1 text-slate-500">{meal.description}</p> : null}
                                                            {meal.address ? <p className="mt-1 text-slate-500">地址：{meal.address}</p> : null}
                                                            {typeof meal.estimated_cost === 'number' ? (
                                                                <p className="mt-1 text-slate-500">
                                                                    预计消费：
                                                                    {formatCurrency(
                                                                        meal.estimated_cost,
                                                                        meal.currency ?? selectedPlan.budget?.currency ?? 'CNY'
                                                                    ) ?? `${meal.estimated_cost}${meal.currency ? ` ${meal.currency}` : ''}`}
                                                                </p>
                                                            ) : null}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : null}
                                    </article>
                                ))}
                            </div>
                        </section>
                    </div>
                ) : (
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
                        <h3 className="text-lg font-semibold text-slate-900">等待生成行程</h3>
                        <p className="mt-2 text-sm text-slate-500">
                            提交左侧表单或从“最近生成的行程”选中一条记录，即可在此查看完整行程详情。
                        </p>
                        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                            小贴士：生成行程后会自动保存至 Supabase，可在“我的行程”页面进行编辑与分享。
                        </p>
                    </div>
                )}
            </aside>
        </div>
    )
}
