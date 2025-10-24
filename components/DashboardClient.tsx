"use client"
import Link from 'next/link'
import {
    useCallback,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type KeyboardEvent as ReactKeyboardEvent,
    type PointerEvent as ReactPointerEvent
} from 'react'
import { useAuth } from './AuthProvider'
import ItineraryInputForm from './ItineraryInputForm'

const MIN_RATIO = 0.35
const MAX_RATIO = 0.75

export default function DashboardClient() {
    const { user } = useAuth()
    const containerRef = useRef<HTMLDivElement>(null)
    const isDraggingRef = useRef(false)
    const [panelRatio, setPanelRatio] = useState(0.6)

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
                            onSubmit={async payload => {
                                // TODO: 调用后端行程规划接口
                                console.log('submit planning request', payload)
                            }}
                        />

                        <section className="rounded-xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                            行程规划结果与历史记录将在这里展示。后续可以接 Supabase 数据或调用 LLM 服务生成行程卡片。
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
                    <div className="relative flex h-[340px] flex-col justify-between sm:h-[380px] lg:h-[480px]">
                        <div className="p-6">
                            <p className="text-xs uppercase tracking-[0.3em] text-blue-200/80">地图概览</p>
                            <h3 className="mt-4 text-xl font-semibold">旅程目的地</h3>
                            <p className="mt-2 text-sm text-slate-200/90">
                                在这里展示行程目的地、酒店与景点标记。当前为占位示意图，可后续接入 Mapbox / 高德 / 谷歌地图等服务。
                            </p>
                        </div>

                        <div className="relative h-full w-full">
                            <div className="absolute inset-6 rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur">
                                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                                    <span className="inline-flex items-center rounded-full bg-blue-500/20 px-3 py-1 text-xs font-medium text-blue-100">
                                        地图预留区域
                                    </span>
                                    <p className="text-sm text-slate-100/80">
                                        上传行程后自动生成路线与热度图，支持放大缩小和收藏地点。
                                    </p>
                                </div>
                            </div>
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
                        <li>• 使用 Mapbox GL、Leaflet 或高德 JS SDK 渲染真实地图。</li>
                        <li>• 结合行程列表生成折线路径与 POI 标注。</li>
                        <li>• 支持“收藏/避开”操作与实时距离估算。</li>
                    </ul>
                </div>
            </aside>
        </div>
    )
}
