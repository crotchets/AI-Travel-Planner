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
import MapPreview from './MapPreview'
import type { TripPlanRecord } from '../types/trip'

const MIN_RATIO = 0.35
const MAX_RATIO = 0.75

export default function DashboardClient() {
    const { user } = useAuth()
    const containerRef = useRef<HTMLDivElement>(null)
    const isDraggingRef = useRef(false)
    const [panelRatio, setPanelRatio] = useState(0.6)
    const amapApiKey = process.env.NEXT_PUBLIC_AMAP_API_KEY
    const [recentPlans, setRecentPlans] = useState<TripPlanRecord[]>([])
    const [isLoadingPlans, setIsLoadingPlans] = useState(false)
    const [plansError, setPlansError] = useState<string | null>(null)

    const fetchRecentPlans = useCallback(async () => {
        if (!user) {
            setRecentPlans([])
            setPlansError(null)
            setIsLoadingPlans(false)
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
                                    {recentPlans.map(plan => (
                                        <li key={plan.id} className="rounded-lg border border-slate-200 p-4 shadow-sm">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div>
                                                    <p className="text-sm font-semibold text-slate-900">
                                                        {plan.city} · {plan.start_date} - {plan.end_date}
                                                    </p>
                                                    <p className="text-xs text-slate-500">
                                                        更新于 {new Date(plan.updated_at ?? plan.created_at).toLocaleString('zh-CN', { hour12: false })}
                                                    </p>
                                                </div>
                                                <Link
                                                    href={`/itineraries#${plan.id}`}
                                                    className="rounded-full border border-blue-500 px-3 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                                                >
                                                    查看详情
                                                </Link>
                                            </div>
                                            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{plan.overall_suggestions}</p>
                                        </li>
                                    ))}
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
                <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 text-white shadow-xl">
                    <div
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(96,165,250,0.35),rgba(15,23,42,0.95))]"
                    />
                    <div className="relative flex h-[340px] flex-col sm:h-[380px] lg:h-[480px]">
                        <div className="p-6 pb-0">
                            <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">地图概览</p>
                            <h3 className="mt-4 text-xl font-semibold">旅程目的地</h3>
                            <p className="mt-2 text-sm text-slate-200/90">
                                基于高德地图 Web JS API 展示行程目的地、酒店与景点标记。当前默认使用占位 Key，请在环境变量中设置
                                <code className="mx-1 rounded bg-white/10 px-1 text-[11px] tracking-wide">NEXT_PUBLIC_AMAP_API_KEY</code>
                                以加载真实地图数据。
                            </p>
                        </div>

                        <div className="flex-1 px-6 pb-6 pt-4">
                            <MapPreview apiKey={amapApiKey} />
                        </div>

                        <div className="flex flex-col gap-2 border-t border-white/10 px-6 py-4 text-xs text-slate-200/70 sm:flex-row sm:items-center sm:justify-between">
                            <span>下一步：接入地图 SDK</span>
                            <button className="w-full rounded-full bg-blue-500/20 px-3 py-1 text-[11px] font-medium text-blue-100 transition hover:bg-blue-500/30 sm:w-auto">
                                查看规划路线
                            </button>
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
                    <p className="font-medium text-slate-900">实现建议</p>
                    <ul className="mt-2 space-y-1 text-xs leading-relaxed text-slate-500">
                        <li>• 配置 <code className="rounded bg-slate-100 px-1">NEXT_PUBLIC_AMAP_API_KEY</code> 加载在线地图。</li>
                        <li>• 结合行程列表生成折线路径与 POI 标注。</li>
                        <li>• 支持“收藏/避开”操作与实时距离估算。</li>
                    </ul>
                </div>
            </aside>
        </div>
    )
}
