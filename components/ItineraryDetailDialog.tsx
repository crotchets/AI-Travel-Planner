"use client"

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { Dialog, Transition } from '@headlessui/react'

import type { TripPlan, TripPlanRecord, TripRequest } from '../types/trip'
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
    onPlanUpdated: (plan: TripPlanRecord) => void
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

function clonePlan(source: TripPlanRecord): TripPlan {
    return {
        city: source.city,
        start_date: source.start_date,
        end_date: source.end_date,
        overall_suggestions: source.overall_suggestions,
        weather_info: source.weather_info.map(item => ({ ...item })),
        days: source.days.map(day => ({
            ...day,
            hotel: day.hotel ? { ...day.hotel } : undefined,
            attractions: day.attractions.map(attraction => ({ ...attraction })),
            meals: day.meals.map(meal => ({ ...meal }))
        })),
        budget: source.budget
            ? {
                ...source.budget,
                categories: source.budget.categories.map(category => ({ ...category }))
            }
            : undefined
    }
}

function cloneRequest(request: TripRequest | null | undefined): TripRequest | null {
    if (!request) return null
    return {
        ...request,
        preferences: request.preferences ? [...request.preferences] : undefined
    }
}

export default function ItineraryDetailDialog({ open, plan, onClose, onPlanUpdated }: ItineraryDetailDialogProps) {
    const [editMode, setEditMode] = useState(false)
    const [planDraft, setPlanDraft] = useState<TripPlan | null>(null)
    const [requestDraft, setRequestDraft] = useState<TripRequest | null>(null)
    const [saving, setSaving] = useState(false)
    const [formError, setFormError] = useState<string | null>(null)

    useEffect(() => {
        if (!plan || !open) {
            setPlanDraft(null)
            setRequestDraft(null)
            setEditMode(false)
            setFormError(null)
            setSaving(false)
            return
        }

        setPlanDraft(clonePlan(plan))
        setRequestDraft(cloneRequest(plan.request))
        setEditMode(false)
        setFormError(null)
        setSaving(false)
    }, [open, plan])

    const displayPlan = useMemo<TripPlanRecord | null>(() => {
        if (!plan) return null
        if (editMode && planDraft) {
            return {
                ...plan,
                ...planDraft
            }
        }
        return plan
    }, [editMode, plan, planDraft])

    const hotels = useMemo(() => uniqueHotels(displayPlan), [displayPlan])
    const transportSegments = useMemo(() => aggregateTransportation(displayPlan), [displayPlan])
    const budget = useMemo(() => calcBudget(displayPlan), [displayPlan])
    const totals = useMemo(() => calcTotals(displayPlan), [displayPlan])

    const handleDialogClose = useCallback(() => {
        if (editMode && plan) {
            setPlanDraft(clonePlan(plan))
            setRequestDraft(cloneRequest(plan.request))
            setEditMode(false)
            setFormError(null)
        }
        onClose()
    }, [editMode, onClose, plan])

    const handleBasicFieldChange = useCallback(
        (field: keyof TripPlan, value: string) => {
            setPlanDraft(prev => {
                if (prev) {
                    return { ...prev, [field]: value }
                }
                if (plan) {
                    const cloned = clonePlan(plan)
                    return { ...cloned, [field]: value }
                }
                return prev
            })
        },
        [plan]
    )

    const handleDayFieldChange = useCallback(
        (dayIndex: number, field: 'date' | 'description' | 'transportation' | 'accommodation', value: string) => {
            setPlanDraft(prev => {
                if (!prev) return prev
                const days = prev.days.map((day, idx) => {
                    if (idx !== dayIndex) return day
                    return { ...day, [field]: value }
                })
                return { ...prev, days }
            })
        },
        []
    )

    const handleHotelFieldChange = useCallback((dayIndex: number, field: 'name' | 'address' | 'price_range', value: string) => {
        setPlanDraft(prev => {
            if (!prev) return prev
            const days = prev.days.map((day, idx) => {
                if (idx !== dayIndex) return day
                const hotel = day.hotel ? { ...day.hotel, [field]: value } : { name: value }
                return { ...day, hotel }
            })
            return { ...prev, days }
        })
    }, [])

    const handleBudgetChange = useCallback((field: 'total' | 'currency', value: string) => {
        setPlanDraft(prev => {
            if (!prev) return prev
            const current = prev.budget ?? { total: 0, currency: value || '￥', categories: [] }
            return {
                ...prev,
                budget: {
                    ...current,
                    [field]: field === 'total' ? Number(value) || 0 : value,
                    categories: current.categories ?? []
                }
            }
        })
    }, [])

    const handleBudgetCategoryChange = useCallback((index: number, key: 'label' | 'amount' | 'currency', value: string) => {
        setPlanDraft(prev => {
            if (!prev) return prev
            const nextBudget = prev.budget ?? { total: 0, currency: '￥', categories: [] }
            const categories = nextBudget.categories.slice()
            const target = categories[index] ?? { label: '', amount: 0 }
            categories[index] = {
                ...target,
                [key]: key === 'amount' ? Number(value) || 0 : value
            }
            return {
                ...prev,
                budget: {
                    ...nextBudget,
                    categories
                }
            }
        })
    }, [])

    const addBudgetCategory = useCallback(() => {
        setPlanDraft(prev => {
            if (!prev) return prev
            const nextBudget = prev.budget ?? { total: 0, currency: '￥', categories: [] }
            return {
                ...prev,
                budget: {
                    ...nextBudget,
                    categories: [...nextBudget.categories, { label: '', amount: 0, currency: nextBudget.currency }]
                }
            }
        })
    }, [])

    const removeBudgetCategory = useCallback((index: number) => {
        setPlanDraft(prev => {
            if (!prev || !prev.budget) return prev
            const categories = prev.budget.categories.filter((_, idx) => idx !== index)
            return {
                ...prev,
                budget: {
                    ...prev.budget,
                    categories
                }
            }
        })
    }, [])

    const handlePreferencesChange = useCallback((value: string) => {
        setRequestDraft(prev => {
            const base: TripRequest = prev ?? {
                city: planDraft?.city ?? plan?.city ?? '',
                start_date: planDraft?.start_date ?? plan?.start_date ?? '',
                end_date: planDraft?.end_date ?? plan?.end_date ?? ''
            }
            const preferences = value
                .split(',')
                .map(item => item.trim())
                .filter(Boolean)
            return {
                ...base,
                preferences: preferences.length ? preferences : undefined
            }
        })
    }, [plan?.city, plan?.end_date, plan?.start_date, planDraft?.city, planDraft?.end_date, planDraft?.start_date])

    const handleRequestFieldChange = useCallback(
        (field: keyof TripRequest, value: string) => {
            setRequestDraft(prev => {
                const base: TripRequest = prev ?? {
                    city: planDraft?.city ?? plan?.city ?? '',
                    start_date: planDraft?.start_date ?? plan?.start_date ?? '',
                    end_date: planDraft?.end_date ?? plan?.end_date ?? ''
                }
                return {
                    ...base,
                    [field]: value
                }
            })
        },
        [plan?.city, plan?.end_date, plan?.start_date, planDraft?.city, planDraft?.end_date, planDraft?.start_date]
    )

    const handleRemoveBudget = useCallback(() => {
        setPlanDraft(prev => {
            if (!prev) return prev
            return { ...prev, budget: undefined }
        })
    }, [])

    const handleSubmit = useCallback(
        async (event: React.FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!plan || !planDraft) {
                return
            }

            setSaving(true)
            setFormError(null)
            try {
                const sanitizedPlan: TripPlan = {
                    ...planDraft,
                    budget: planDraft.budget
                        ? {
                            ...planDraft.budget,
                            categories: (planDraft.budget.categories ?? []).filter(category => category.label.trim())
                        }
                        : undefined
                }

                const sanitizedRequest = requestDraft
                    ? {
                        ...requestDraft,
                        preferences: requestDraft.preferences?.map(item => item.trim()).filter(Boolean)
                    }
                    : null

                const response = await fetch(`/api/itineraries/${plan.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ plan: sanitizedPlan, request: sanitizedRequest })
                })

                const payload = (await response.json().catch(() => null)) as { data?: TripPlanRecord; error?: string } | null

                if (!response.ok || !payload?.data) {
                    throw new Error(payload?.error || '更新行程失败。')
                }

                const updated = payload.data
                onPlanUpdated(updated)
                setPlanDraft(clonePlan(updated))
                setRequestDraft(cloneRequest(updated.request))
                setEditMode(false)
            } catch (error) {
                const message = error instanceof Error ? error.message : '保存失败，请稍后重试。'
                setFormError(message)
            } finally {
                setSaving(false)
            }
        },
        [onPlanUpdated, plan, planDraft, requestDraft]
    )

    if (!plan || !displayPlan) {
        return null
    }

    return (
        <Transition show={open} as={Fragment} appear>
            <Dialog onClose={handleDialogClose} className="relative z-[80]">
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
                                    onClick={handleDialogClose}
                                    className="absolute right-5 top-5 inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition hover:bg-slate-200 hover:text-slate-700"
                                    aria-label="关闭详情"
                                >
                                    <span className="text-lg font-semibold">×</span>
                                </button>

                                <div className="absolute right-20 top-5 flex items-center gap-3">
                                    {editMode ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (!plan) return
                                                    setPlanDraft(clonePlan(plan))
                                                    setRequestDraft(cloneRequest(plan.request))
                                                    setEditMode(false)
                                                    setFormError(null)
                                                }}
                                                className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400"
                                                disabled={saving}
                                            >
                                                取消
                                            </button>
                                            <button
                                                type="submit"
                                                form="itinerary-detail-form"
                                                className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                                                disabled={saving}
                                            >
                                                {saving ? '保存中…' : '保存修改'}
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!plan) return
                                                setPlanDraft(clonePlan(plan))
                                                setRequestDraft(cloneRequest(plan.request))
                                                setEditMode(true)
                                            }}
                                            className="rounded-full border border-blue-500 px-4 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                                        >
                                            编辑
                                        </button>
                                    )}
                                </div>

                                <form
                                    id="itinerary-detail-form"
                                    className="space-y-8"
                                    onSubmit={handleSubmit}
                                >
                                    <header className="pr-12">
                                        <Dialog.Title className="text-2xl font-semibold text-slate-900">
                                            {editMode ? (
                                                <input
                                                    type="text"
                                                    value={planDraft?.city ?? ''}
                                                    onChange={event => handleBasicFieldChange('city', event.target.value)}
                                                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-lg font-semibold text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                    placeholder="输入目的地城市"
                                                />
                                            ) : (
                                                <span>
                                                    {displayPlan.city} {totals.days > 0 ? `${totals.days} 日行程` : ''}
                                                </span>
                                            )}
                                        </Dialog.Title>
                                        <div className="mt-3 text-sm text-slate-500">
                                            {editMode ? (
                                                <div className="grid gap-3 sm:grid-cols-3">
                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">开始日期</span>
                                                        <input
                                                            type="date"
                                                            value={planDraft?.start_date ?? ''}
                                                            onChange={event => handleBasicFieldChange('start_date', event.target.value)}
                                                            className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                        />
                                                    </label>
                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">结束日期</span>
                                                        <input
                                                            type="date"
                                                            value={planDraft?.end_date ?? ''}
                                                            onChange={event => handleBasicFieldChange('end_date', event.target.value)}
                                                            className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                        />
                                                    </label>
                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">总结</span>
                                                        <input
                                                            type="text"
                                                            value={totals.attractions > 0 ? `共 ${totals.attractions} 个景点` : ''}
                                                            readOnly
                                                            className="h-10 rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
                                                        />
                                                    </label>
                                                </div>
                                            ) : (
                                                <p>
                                                    出行时间：{formatDate(displayPlan.start_date)} - {formatDate(displayPlan.end_date)} · 保存于{' '}
                                                    {formatDate(displayPlan.created_at)}
                                                </p>
                                            )}
                                        </div>
                                        <div className="mt-4">
                                            {editMode ? (
                                                <label className="flex flex-col gap-1 text-sm text-slate-600">
                                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">总体建议</span>
                                                    <textarea
                                                        value={planDraft?.overall_suggestions ?? ''}
                                                        onChange={event => handleBasicFieldChange('overall_suggestions', event.target.value)}
                                                        rows={4}
                                                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                    />
                                                </label>
                                            ) : (
                                                <p className="text-base text-slate-600 leading-relaxed">
                                                    {displayPlan.overall_suggestions}
                                                </p>
                                            )}
                                        </div>
                                        {!editMode ? (
                                            <div className="mt-3 flex flex-wrap gap-3 text-sm text-slate-500">
                                                <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">共 {totals.attractions} 个景点</span>
                                                {displayPlan.request?.budget_level ? (
                                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
                                                        预算偏好：{displayPlan.request.budget_level}
                                                    </span>
                                                ) : null}
                                                {displayPlan.request?.preferences?.length ? (
                                                    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1">
                                                        兴趣偏好：{displayPlan.request.preferences.join('、')}
                                                    </span>
                                                ) : null}
                                            </div>
                                        ) : null}
                                    </header>

                                    {formError ? (
                                        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-600">{formError}</p>
                                    ) : null}

                                    <div className="grid gap-6 lg:grid-cols-[1.4fr,1fr]">
                                        <section className="max-h-[560px] overflow-y-auto pr-3">
                                            <div className="space-y-5">
                                                {displayPlan.days.map((day, idx) => (
                                                    <article key={day.date ?? idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                        <header className="flex flex-wrap items-center justify-between gap-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-xs uppercase tracking-wide text-slate-400">Day {idx + 1}</span>
                                                                {editMode ? (
                                                                    <input
                                                                        type="date"
                                                                        value={planDraft?.days[idx]?.date ?? ''}
                                                                        onChange={event => handleDayFieldChange(idx, 'date', event.target.value)}
                                                                        className="mt-1 h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                    />
                                                                ) : (
                                                                    <p className="text-sm font-semibold text-slate-900">{formatDate(day.date)}</p>
                                                                )}
                                                            </div>
                                                            {!editMode && day.description ? (
                                                                <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
                                                                    {day.description}
                                                                </span>
                                                            ) : null}
                                                        </header>

                                                        {editMode ? (
                                                            <div className="mt-4 space-y-3 text-sm text-slate-600">
                                                                <label className="flex flex-col gap-1">
                                                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">日程摘要</span>
                                                                    <textarea
                                                                        value={planDraft?.days[idx]?.description ?? ''}
                                                                        onChange={event => handleDayFieldChange(idx, 'description', event.target.value)}
                                                                        rows={2}
                                                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                    />
                                                                </label>
                                                                <label className="flex flex-col gap-1">
                                                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">交通安排</span>
                                                                    <textarea
                                                                        value={planDraft?.days[idx]?.transportation ?? ''}
                                                                        onChange={event => handleDayFieldChange(idx, 'transportation', event.target.value)}
                                                                        rows={2}
                                                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                    />
                                                                </label>
                                                                <label className="flex flex-col gap-1">
                                                                    <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">住宿安排</span>
                                                                    <textarea
                                                                        value={planDraft?.days[idx]?.accommodation ?? ''}
                                                                        onChange={event => handleDayFieldChange(idx, 'accommodation', event.target.value)}
                                                                        rows={2}
                                                                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                    />
                                                                </label>
                                                                <div className="grid gap-3 sm:grid-cols-3">
                                                                    <label className="flex flex-col gap-1">
                                                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">酒店名称</span>
                                                                        <input
                                                                            type="text"
                                                                            value={planDraft?.days[idx]?.hotel?.name ?? ''}
                                                                            onChange={event => handleHotelFieldChange(idx, 'name', event.target.value)}
                                                                            className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                        />
                                                                    </label>
                                                                    <label className="flex flex-col gap-1 sm:col-span-2">
                                                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">酒店地址</span>
                                                                        <input
                                                                            type="text"
                                                                            value={planDraft?.days[idx]?.hotel?.address ?? ''}
                                                                            onChange={event => handleHotelFieldChange(idx, 'address', event.target.value)}
                                                                            className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                        />
                                                                    </label>
                                                                    <label className="flex flex-col gap-1">
                                                                        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">价位</span>
                                                                        <input
                                                                            type="text"
                                                                            value={planDraft?.days[idx]?.hotel?.price_range ?? ''}
                                                                            onChange={event => handleHotelFieldChange(idx, 'price_range', event.target.value)}
                                                                            className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                        />
                                                                    </label>
                                                                </div>
                                                                <p className="text-xs text-slate-400">
                                                                    景点与餐饮暂为只读，如需大幅修改可重新生成或联系管理员。
                                                                </p>
                                                            </div>
                                                        ) : (
                                                            <>
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
                                                            </>
                                                        )}
                                                    </article>
                                                ))}
                                            </div>
                                        </section>

                                        <section className="space-y-5">
                                            <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                <h3 className="mb-3 text-base font-semibold text-slate-900">行程地图</h3>
                                                <ItineraryMap plan={displayPlan} />
                                            </div>

                                            {displayPlan.weather_info.length ? (
                                                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                                    <h3 className="mb-3 text-base font-semibold text-slate-900">天气预报</h3>
                                                    <div className="grid gap-3 sm:grid-cols-2">
                                                        {displayPlan.weather_info.map(weather => (
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
                                            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                                                <h3 className="text-sm font-semibold text-slate-900">预算分配</h3>
                                                {editMode ? (
                                                    <div className="mt-3 space-y-3 text-sm text-slate-600">
                                                        <div className="grid gap-3 sm:grid-cols-2">
                                                            <label className="flex flex-col gap-1">
                                                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">总预算</span>
                                                                <input
                                                                    type="number"
                                                                    value={planDraft?.budget?.total ?? 0}
                                                                    onChange={event => handleBudgetChange('total', event.target.value)}
                                                                    className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                />
                                                            </label>
                                                            <label className="flex flex-col gap-1">
                                                                <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">币种</span>
                                                                <input
                                                                    type="text"
                                                                    value={planDraft?.budget?.currency ?? '￥'}
                                                                    onChange={event => handleBudgetChange('currency', event.target.value)}
                                                                    className="h-10 rounded-lg border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                />
                                                            </label>
                                                        </div>
                                                        <div className="space-y-3">
                                                            {(planDraft?.budget?.categories ?? []).map((category, index) => (
                                                                <div key={index} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr,1fr,auto]">
                                                                    <label className="flex flex-col gap-1 text-xs">
                                                                        <span className="font-semibold uppercase tracking-wide text-slate-500">类别</span>
                                                                        <input
                                                                            type="text"
                                                                            value={category.label}
                                                                            onChange={event => handleBudgetCategoryChange(index, 'label', event.target.value)}
                                                                            className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                        />
                                                                    </label>
                                                                    <label className="flex flex-col gap-1 text-xs">
                                                                        <span className="font-semibold uppercase tracking-wide text-slate-500">金额</span>
                                                                        <input
                                                                            type="number"
                                                                            value={category.amount}
                                                                            onChange={event => handleBudgetCategoryChange(index, 'amount', event.target.value)}
                                                                            className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                        />
                                                                    </label>
                                                                    <div className="flex items-end justify-between gap-2 sm:flex-col sm:items-start">
                                                                        <label className="flex w-full flex-col gap-1 text-xs">
                                                                            <span className="font-semibold uppercase tracking-wide text-slate-500">币种</span>
                                                                            <input
                                                                                type="text"
                                                                                value={category.currency ?? planDraft?.budget?.currency ?? '￥'}
                                                                                onChange={event => handleBudgetCategoryChange(index, 'currency', event.target.value)}
                                                                                className="h-10 rounded-md border border-slate-200 px-3 text-sm text-slate-700 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                                                            />
                                                                        </label>
                                                                        <button
                                                                            type="button"
                                                                            onClick={() => removeBudgetCategory(index)}
                                                                            className="self-end rounded-full border border-red-200 px-3 py-1 text-xs font-semibold text-red-500 hover:border-red-300 hover:text-red-600"
                                                                        >
                                                                            删除
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <div className="flex flex-wrap gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={addBudgetCategory}
                                                                className="rounded-full border border-blue-500 px-4 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50"
                                                            >
                                                                新增类别
                                                            </button>
                                                            {planDraft?.budget ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={handleRemoveBudget}
                                                                    className="rounded-full border border-slate-300 px-4 py-1.5 text-xs font-semibold text-slate-600 hover:border-slate-400"
                                                                >
                                                                    清除预算
                                                                </button>
                                                            ) : null}
                                                        </div>
                                                    </div>
                                                ) : budget ? (
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
                                        </section>
                                    </div>

                                    <footer className="grid gap-4 md:grid-cols-2">
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
                                    </footer>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    )
}
