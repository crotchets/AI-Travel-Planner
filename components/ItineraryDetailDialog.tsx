"use client"

import { Fragment, useMemo } from 'react'
import { Dialog, Transition } from '@headlessui/react'

import type { TripPlanRecord } from '../types/trip'
import ItineraryMap from './ItineraryMap'

const formatter = new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
})

function formatDate(date: string | undefined) {
    if (!date) return ''
    try {
        return formatter.format(new Date(date))
    } catch (err) {
        return date
    }
}

type ItineraryDetailDialogProps = {
    open: boolean
    plan: TripPlanRecord | null
    onClose: () => void
}

function uniqueHotels(plan: TripPlanRecord | null) {
    if (!plan) return []
    const map = new Map<string, { name: string; address?: string; rating?: number; priceRange?: string }>()
    plan.days.forEach(day => {
        if (day.hotel?.name) {
            const key = day.hotel.name
            if (!map.has(key)) {
                map.set(key, {
                    name: day.hotel.name,
                    address: day.hotel.address,
                    rating: day.hotel.rating,
                    priceRange: day.hotel.price_range
                })
            }
        }
    })
    return Array.from(map.values())
}

function aggregateTransportation(plan: TripPlanRecord | null) {
    if (!plan) return []
    const segments = new Set<string>()
    plan.days.forEach(day => {
        if (day.transportation) {
            segments.add(day.transportation)
        }
    })
    if (plan.request?.transportation) {
        segments.add(`偏好：${plan.request.transportation}`)
    }
    return Array.from(segments)
}

function calcBudget(plan: TripPlanRecord | null) {
    if (!plan?.budget) return null
    const { total, currency, categories } = plan.budget
    return {
        total,
        currency: currency ?? '￥',
        categories: categories ?? []
    }
}

function calcTotals(plan: TripPlanRecord | null) {
    if (!plan) {
        return { days: 0, attractions: 0 }
    }
    const dayCount = plan.days.length
    const attractionCount = plan.days.reduce((acc, day) => acc + day.attractions.length, 0)
    return { days: dayCount, attractions: attractionCount }
}

export default function ItineraryDetailDialog({ open, plan, onClose }: ItineraryDetailDialogProps) {
    const hotels = useMemo(() => uniqueHotels(plan), [plan])
    const transportSegments = useMemo(() => aggregateTransportation(plan), [plan])
    const budget = useMemo(() => calcBudget(plan), [plan])
    const totals = useMemo(() => calcTotals(plan), [plan])

    if (!plan) {
        return null
    }

    return (
        <Transition show={open} as={Fragment} appear>
            <Dialog onClose={onClose} className="relative z-[80]">
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-200"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-150"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto py-10">
                    <div className="flex min-h-full items-center justify-center px-4">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-200"
                            enterFrom="opacity-0 translate-y-4"
                            enterTo="opacity-100 translate-y-0"
                            leave="ease-in duration-150"
                            leaveFrom="opacity-100 translate-y-0"
                            leaveTo="opacity-0 translate-y-4"
                        >
                            <Dialog.Panel className="relative w-full max-w-6xl overflow-hidden rounded-3xl bg-white p-8 shadow-2xl">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                                    aria-label="关闭详情"
                                >
                                    <span className="text-lg font-semibold">×</span>
                                </button>

                                <header className="mb-6 pr-12">
                                    <Dialog.Title className="text-2xl font-semibold text-slate-900">
                                        {plan.city} {totals.days > 0 ? `${totals.days} 日行程` : ''}
                                    </Dialog.Title>
                                    <p className="mt-1 text-sm text-slate-500">
                                        出行时间：{formatDate(plan.start_date)} - {formatDate(plan.end_date)} · 保存于{' '}
                                        {formatDate(plan.created_at)}
                                    </p>
                                    <p className="mt-3 text-base text-slate-600 leading-relaxed">
                                        {plan.overall_suggestions}
                                    </p>
                                    <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                                        <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">共 {totals.attractions} 个景点</span>
                                        {plan.request?.budget_level ? (
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
                                                预算偏好：{plan.request.budget_level}
                                            </span>
                                        ) : null}
                                        {plan.request?.preferences?.length ? (
                                            <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
                                                兴趣偏好：{plan.request.preferences.join('、')}
                                            </span>
                                        ) : null}
                                    </div>
                                </header>

                                <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
                                    <section className="max-h-[560px] overflow-y-auto pr-3">
                                        <div className="space-y-5">
                                            {plan.days.map((day, idx) => (
                                                <article key={day.date ?? idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                    <header className="flex flex-wrap items-center justify-between gap-2">
                                                        <div>
                                                            <h3 className="text-lg font-semibold text-slate-900">Day {idx + 1}</h3>
                                                            <p className="text-xs uppercase tracking-wide text-slate-400">
                                                                {formatDate(day.date)}
                                                            </p>
                                                        </div>
                                                        {day.description ? (
                                                            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                                                                {day.description}
                                                            </span>
                                                        ) : null}
                                                    </header>

                                                    <div className="mt-3 space-y-2 text-sm text-slate-600">
                                                        {day.transportation ? (
                                                            <p>交通安排：{day.transportation}</p>
                                                        ) : null}
                                                        {day.accommodation ? (
                                                            <p>住宿：{day.accommodation}</p>
                                                        ) : null}
                                                        {day.hotel ? (
                                                            <p>
                                                                推荐酒店：{day.hotel.name}
                                                                {day.hotel.price_range ? ` · ${day.hotel.price_range}` : ''}
                                                            </p>
                                                        ) : null}
                                                    </div>

                                                    <div className="mt-4 space-y-4">
                                                        {day.attractions.map((attraction, attractionIdx) => (
                                                            <div
                                                                key={`${attraction.name}-${attractionIdx}`}
                                                                className="rounded-xl border border-slate-200 bg-slate-50/60 p-4"
                                                            >
                                                                <div className="flex flex-wrap items-baseline justify-between gap-2">
                                                                    <h4 className="text-base font-semibold text-slate-900">
                                                                        {attraction.name || `景点 ${attractionIdx + 1}`}
                                                                    </h4>
                                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                                        {attraction.category ? (
                                                                            <span className="rounded-full bg-slate-200 px-2 py-0.5">
                                                                                {attraction.category}
                                                                            </span>
                                                                        ) : null}
                                                                        {typeof attraction.estimated_duration_hours === 'number' ? (
                                                                            <span>约 {attraction.estimated_duration_hours} 小时</span>
                                                                        ) : null}
                                                                        {typeof attraction.ticket_price === 'number' ? (
                                                                            <span>
                                                                                门票：{attraction.ticket_price}
                                                                                {attraction.currency ?? ''}
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                </div>
                                                                {attraction.address ? (
                                                                    <p className="mt-1 text-xs tracking-wide text-slate-400">
                                                                        {attraction.address}
                                                                    </p>
                                                                ) : null}
                                                                {attraction.description ? (
                                                                    <p className="mt-3 text-sm text-slate-600 leading-relaxed">
                                                                        {attraction.description}
                                                                    </p>
                                                                ) : null}
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {day.meals.length ? (
                                                        <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
                                                            <h4 className="text-sm font-semibold text-amber-700">餐饮推荐</h4>
                                                            <ul className="mt-2 space-y-2 text-sm text-amber-900">
                                                                {day.meals.map((meal, mealIdx) => (
                                                                    <li key={`${meal.name}-${mealIdx}`} className="flex flex-wrap items-center justify-between gap-2">
                                                                        <span className="font-medium">{meal.name}</span>
                                                                        <span className="text-xs text-amber-600">{meal.type}</span>
                                                                        {typeof meal.estimated_cost === 'number' ? (
                                                                            <span className="text-xs text-amber-600">
                                                                                约 {meal.estimated_cost}
                                                                                {meal.currency ?? ''}
                                                                            </span>
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

                                    <section className="space-y-5">
                                        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                            <h3 className="mb-3 text-base font-semibold text-slate-900">行程地图</h3>
                                            <ItineraryMap plan={plan} />
                                        </div>

                                        {plan.weather_info.length ? (
                                            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <h3 className="mb-3 text-base font-semibold text-slate-900">天气预报</h3>
                                                <div className="grid gap-3 sm:grid-cols-2">
                                                    {plan.weather_info.map(weather => (
                                                        <div key={weather.date} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                                                            <p className="text-xs uppercase tracking-wide text-slate-400">
                                                                {formatDate(weather.date)}
                                                            </p>
                                                            <p className="mt-1 text-lg font-semibold text-slate-900">
                                                                {weather.temperature}° · {weather.condition}
                                                            </p>
                                                            {weather.wind ? (
                                                                <p className="text-xs text-slate-500">{weather.wind}</p>
                                                            ) : null}
                                                            {typeof weather.humidity === 'number' ? (
                                                                <p className="text-xs text-slate-500">湿度：{weather.humidity}%</p>
                                                            ) : null}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ) : null}
                                    </section>
                                </div>

                                <footer className="mt-6 grid gap-4 md:grid-cols-3">
                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <h4 className="text-sm font-semibold text-slate-900">住宿推荐</h4>
                                        {hotels.length ? (
                                            <ul className="mt-3 space-y-3 text-sm text-slate-600">
                                                {hotels.map(hotel => (
                                                    <li key={hotel.name}>
                                                        <p className="font-medium text-slate-900">{hotel.name}</p>
                                                        {hotel.address ? <p className="text-xs text-slate-500">{hotel.address}</p> : null}
                                                        <div className="mt-1 flex flex-wrap gap-3 text-xs text-slate-500">
                                                            {typeof hotel.rating === 'number' ? (
                                                                <span>评分 {hotel.rating.toFixed(1)}</span>
                                                            ) : null}
                                                            {hotel.priceRange ? <span>{hotel.priceRange}</span> : null}
                                                        </div>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="mt-3 text-sm text-slate-500">此行程未提供酒店推荐。</p>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <h4 className="text-sm font-semibold text-slate-900">交通方案</h4>
                                        {transportSegments.length ? (
                                            <ul className="mt-3 space-y-2 text-sm text-slate-600">
                                                {transportSegments.map(segment => (
                                                    <li key={segment} className="flex items-start gap-2">
                                                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-500" />
                                                        <span>{segment}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="mt-3 text-sm text-slate-500">暂无具体交通信息，可根据实际情况调整。</p>
                                        )}
                                    </div>

                                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                        <h4 className="text-sm font-semibold text-slate-900">预算分配</h4>
                                        {budget ? (
                                            <>
                                                <p className="mt-2 text-sm text-slate-600">
                                                    总预算：{budget.total}
                                                    {budget.currency}
                                                </p>
                                                <ul className="mt-3 space-y-2 text-sm text-slate-600">
                                                    {budget.categories.map(category => (
                                                        <li key={category.label} className="flex items-center justify-between">
                                                            <span>{category.label}</span>
                                                            <span>
                                                                {category.amount}
                                                                {category.currency ?? budget.currency}
                                                            </span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </>
                                        ) : (
                                            <p className="mt-3 text-sm text-slate-500">暂未定义预算信息。</p>
                                        )}
                                    </div>
                                </footer>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
