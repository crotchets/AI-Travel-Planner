"use client"

import type { FormEvent } from 'react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { format } from 'date-fns'
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import * as XLSX from 'xlsx'

import { EXPENSE_CATEGORY_CATALOG, PAYMENT_METHOD_CATALOG } from '../lib/expenseCatalog'
import type { TripPlanRecord } from '../types/trip'
import type {
    ExpenseCategoryKey,
    ExpenseRecord,
    ExpenseStatsByDate,
    ExpenseStatsCategory,
    ExpenseStatsResponse,
    ExpenseStatsView,
    PaymentMethodKey
} from '../types/expense'

import ProtectedClient from './ProtectedClient'

type ExpenseFormState = {
    amount: string
    currency: string
    category: ExpenseCategoryKey
    payment_method: PaymentMethodKey
    spent_at: string
    description: string
}

type ExpenseFilters = {
    category: ExpenseCategoryKey | 'all'
    payment_method: PaymentMethodKey | 'all'
    start_date: string | null
    end_date: string | null
}

type CategoryStat = ExpenseStatsCategory

type DateStat = ExpenseStatsByDate

type ExpenseStats = ExpenseStatsView

const TARGET_SAMPLE_RATE = 16000

const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_CATALOG
const PAYMENT_METHODS = PAYMENT_METHOD_CATALOG

const CATEGORY_LOOKUP = Object.fromEntries(EXPENSE_CATEGORIES.map(item => [item.value, item.label])) as Record<
    ExpenseCategoryKey,
    string
>
const CATEGORY_COLOR_LOOKUP = Object.fromEntries(EXPENSE_CATEGORIES.map(item => [item.value, item.color])) as Record<
    ExpenseCategoryKey,
    string
>
const PAYMENT_LOOKUP = Object.fromEntries(PAYMENT_METHODS.map(item => [item.value, item.label])) as Record<
    PaymentMethodKey,
    string
>

function createDefaultFormState(spentAtOverride?: string): ExpenseFormState {
    const today = format(new Date(), 'yyyy-MM-dd')
    return {
        amount: '',
        currency: 'CNY',
        category: 'meal',
        payment_method: 'mobile_payment',
        spent_at: spentAtOverride ?? today,
        description: ''
    }
}

function buildQueryParams(filters: ExpenseFilters, tripId: string | null) {
    const params = new URLSearchParams()
    if (tripId) {
        params.set('trip_id', tripId)
    }
    if (filters.category !== 'all') {
        params.set('category', filters.category)
    }
    if (filters.payment_method !== 'all') {
        params.set('payment_method', filters.payment_method)
    }
    if (filters.start_date) {
        params.set('start_date', filters.start_date)
    }
    if (filters.end_date) {
        params.set('end_date', filters.end_date)
    }
    return params
}

function formatAmount(amount: number, currency?: string | null) {
    try {
        return new Intl.NumberFormat('zh-CN', {
            style: 'currency',
            currency: currency ?? 'CNY'
        }).format(amount)
    } catch {
        return `${amount.toFixed(2)} ${currency ?? ''}`.trim()
    }
}

function parseBudgetValue(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string') {
        const parsed = Number.parseFloat(value)
        return Number.isFinite(parsed) ? parsed : null
    }
    return null
}

function clampDateToTrip(date: string, trip: TripPlanRecord): string {
    const base = date ? date.slice(0, 10) : trip.start_date
    if (base < trip.start_date) return trip.start_date
    if (base > trip.end_date) return trip.end_date
    return base
}

function transformStatsResponse(response: ExpenseStatsResponse): ExpenseStats {
    return {
        tripId: response.trip_id,
        totalSpent: response.total_spent,
        budgetTotal: response.budget_total,
        budgetDelta: response.budget_delta,
        byCategory: response.by_category,
        byDate: response.by_date
    }
}

function mixDownToMono(buffer: AudioBuffer) {
    if (buffer.numberOfChannels === 1) {
        return buffer.getChannelData(0)
    }

    const length = buffer.length
    const result = new Float32Array(length)

    for (let channel = 0; channel < buffer.numberOfChannels; channel += 1) {
        const channelData = buffer.getChannelData(channel)
        for (let i = 0; i < length; i += 1) {
            result[i] += channelData[i]
        }
    }

    for (let i = 0; i < length; i += 1) {
        result[i] /= buffer.numberOfChannels
    }

    return result
}

function downsampleToRate(data: Float32Array, originalSampleRate: number, targetSampleRate: number) {
    if (!Number.isFinite(originalSampleRate) || originalSampleRate <= 0) {
        throw new Error('无法解析录音采样率。')
    }

    if (!Number.isFinite(targetSampleRate) || targetSampleRate <= 0 || targetSampleRate >= originalSampleRate) {
        return { data, sampleRate: originalSampleRate }
    }

    const ratio = originalSampleRate / targetSampleRate
    const newLength = Math.max(1, Math.floor(data.length / ratio))
    const result = new Float32Array(newLength)

    let offsetResult = 0
    let offsetBuffer = 0

    while (offsetResult < newLength) {
        const nextOffsetBuffer = Math.floor((offsetResult + 1) * ratio)
        let accum = 0
        let count = 0
        for (let i = offsetBuffer; i < nextOffsetBuffer && i < data.length; i += 1) {
            accum += data[i]
            count += 1
        }
        result[offsetResult] = count > 0 ? accum / count : 0
        offsetResult += 1
        offsetBuffer = nextOffsetBuffer
    }

    return { data: result, sampleRate: targetSampleRate }
}

function floatTo16BitPCM(float32Array: Float32Array) {
    const buffer = new ArrayBuffer(float32Array.length * 2)
    const view = new DataView(buffer)

    for (let i = 0; i < float32Array.length; i += 1) {
        let sample = Math.max(-1, Math.min(1, float32Array[i]))
        sample = sample < 0 ? sample * 0x8000 : sample * 0x7fff
        view.setInt16(i * 2, sample, true)
    }

    return buffer
}

function arrayBufferToBase64(buffer: ArrayBuffer) {
    let binary = ''
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000

    for (let i = 0; i < bytes.byteLength; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize)
        binary += String.fromCharCode(...chunk)
    }

    return btoa(binary)
}

async function convertBlobToPcmBase64(blob: Blob, targetSampleRate: number) {
    const AudioContextCtor = window.AudioContext ?? (window as any).webkitAudioContext
    if (!AudioContextCtor) {
        throw new Error('当前浏览器不支持音频处理。')
    }

    const audioContext = new AudioContextCtor()

    try {
        const arrayBuffer = await blob.arrayBuffer()
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
        const monoData = mixDownToMono(audioBuffer)
        const { data, sampleRate } = downsampleToRate(monoData, audioBuffer.sampleRate, targetSampleRate)
        const pcmBuffer = floatTo16BitPCM(data)
        const base64 = arrayBufferToBase64(pcmBuffer)

        return { base64, sampleRate }
    } finally {
        await audioContext.close()
    }
}

function parseDateFromText(text: string) {
    const isoMatch = text.match(/(20\d{2})[-年\/.](\d{1,2})[-月\/.](\d{1,2})/)
    if (isoMatch) {
        const year = isoMatch[1]
        const month = isoMatch[2].padStart(2, '0')
        const day = isoMatch[3].padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    const monthDayMatch = text.match(/(\d{1,2})月(\d{1,2})日/)
    if (monthDayMatch) {
        const year = new Date().getFullYear().toString()
        const month = monthDayMatch[1].padStart(2, '0')
        const day = monthDayMatch[2].padStart(2, '0')
        return `${year}-${month}-${day}`
    }

    return format(new Date(), 'yyyy-MM-dd')
}

function parseExpenseFromTranscript(transcript: string) {
    const lower = transcript.toLowerCase()
    const amountMatch = transcript.match(/(\d+(?:\.\d+)?)/)
    const amount = amountMatch ? amountMatch[1] : ''
    const spent_at = parseDateFromText(transcript)

    let category: ExpenseCategoryKey = 'other'
    for (const item of EXPENSE_CATEGORIES) {
        if (item.keywords.some(keyword => transcript.includes(keyword))) {
            category = item.value
            break
        }
    }

    let payment: PaymentMethodKey = 'mobile_payment'
    for (const item of PAYMENT_METHODS) {
        if (item.keywords.some(keyword => transcript.includes(keyword) || lower.includes(keyword))) {
            payment = item.value
            break
        }
    }

    return {
        amount,
        spent_at,
        category,
        payment_method: payment,
        description: transcript.replace(/\s+/g, ' ').trim()
    }
}

function downloadBlob(content: BlobPart, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export default function BudgetClient() {
    const [trips, setTrips] = useState<TripPlanRecord[]>([])
    const [isTripLoading, setIsTripLoading] = useState(false)
    const [tripError, setTripError] = useState<string | null>(null)
    const [selectedTripId, setSelectedTripId] = useState<string | null>(null)

    const [expenses, setExpenses] = useState<ExpenseRecord[]>([])
    const [stats, setStats] = useState<ExpenseStats | null>(null)
    const [filters, setFilters] = useState<ExpenseFilters>({
        category: 'all',
        payment_method: 'all',
        start_date: null,
        end_date: null
    })
    const [isLoading, setIsLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [formState, setFormState] = useState<ExpenseFormState>(() => createDefaultFormState())
    const [editingExpenseId, setEditingExpenseId] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [voiceStatus, setVoiceStatus] = useState<'idle' | 'recording' | 'processing' | 'error'>('idle')
    const [voiceError, setVoiceError] = useState<string | null>(null)

    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioChunksRef = useRef<Blob[]>([])

    const selectedTrip = useMemo(
        () => (selectedTripId ? trips.find(item => item.id === selectedTripId) ?? null : null),
        [selectedTripId, trips]
    )

    const queryString = useMemo(() => {
        if (!selectedTripId) return ''
        return buildQueryParams(filters, selectedTripId).toString()
    }, [filters, selectedTripId])

    const fetchTrips = useCallback(async () => {
        setIsTripLoading(true)
        setTripError(null)
        try {
            const response = await fetch('/api/itineraries', { method: 'GET' })
            const payload = (await response.json()) as { data?: TripPlanRecord[]; error?: string }
            if (!response.ok) {
                throw new Error(payload.error ?? '加载行程列表失败。')
            }
            const records = payload.data ?? []
            setTrips(records)
            if (records.length === 0) {
                setSelectedTripId(null)
                return
            }
            setSelectedTripId(prev => {
                if (prev && records.some(item => item.id === prev)) {
                    return prev
                }
                return records[0]?.id ?? null
            })
        } catch (err) {
            console.error(err)
            setTrips([])
            setSelectedTripId(null)
            setTripError(err instanceof Error ? err.message : '加载行程列表失败。')
        } finally {
            setIsTripLoading(false)
        }
    }, [])

    const fetchExpenses = useCallback(async () => {
        if (!selectedTripId) {
            setExpenses([])
            setStats(null)
            return
        }
        setIsLoading(true)
        setError(null)
        try {
            const response = await fetch(`/api/expenses${queryString ? `?${queryString}` : ''}`, { method: 'GET' })
            const payload = (await response.json()) as { data?: ExpenseRecord[]; error?: string }
            if (!response.ok) {
                throw new Error(payload.error ?? '加载费用数据失败。')
            }
            setExpenses(payload.data ?? [])
        } catch (err) {
            console.error(err)
            setExpenses([])
            setError(err instanceof Error ? err.message : '加载费用数据失败。')
        } finally {
            setIsLoading(false)
        }
    }, [queryString, selectedTripId])

    const fetchStats = useCallback(async () => {
        if (!selectedTripId) {
            setStats(null)
            return
        }
        try {
            const response = await fetch(`/api/expenses/stats${queryString ? `?${queryString}` : ''}`, { method: 'GET' })
            if (!response.ok) {
                setStats(null)
                return
            }
            const payload = (await response.json()) as { data?: ExpenseStatsResponse }
            if (payload.data) {
                setStats(transformStatsResponse(payload.data))
            } else {
                setStats(null)
            }
        } catch (err) {
            console.error(err)
            setStats(null)
        }
    }, [queryString, selectedTripId])

    useEffect(() => {
        void fetchTrips()
    }, [fetchTrips])

    useEffect(() => {
        void fetchExpenses()
        void fetchStats()
    }, [fetchExpenses, fetchStats])

    const resetForm = useCallback(() => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const spentAt = selectedTrip ? clampDateToTrip(today, selectedTrip) : today
        setFormState(createDefaultFormState(spentAt))
        setEditingExpenseId(null)
    }, [selectedTrip])

    useEffect(() => {
        if (!selectedTripId) {
            setFilters({ category: 'all', payment_method: 'all', start_date: null, end_date: null })
            setExpenses([])
            setStats(null)
            setError(null)
            return
        }
        setFilters({ category: 'all', payment_method: 'all', start_date: null, end_date: null })
        resetForm()
        setError(null)
    }, [resetForm, selectedTripId])

    useEffect(() => {
        if (!selectedTrip) return
        setFormState(prev => ({
            ...prev,
            spent_at: clampDateToTrip(prev.spent_at, selectedTrip)
        }))
    }, [selectedTrip])

    const handleFormChange = useCallback(<K extends keyof ExpenseFormState>(key: K, value: ExpenseFormState[K]) => {
        setFormState(prev => ({ ...prev, [key]: value }))
    }, [])

    const handleSubmit = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!selectedTripId) {
                setError('请选择行程后再录入费用。')
                return
            }
            if (!formState.amount.trim()) {
                setError('请输入费用金额。')
                return
            }
            const amount = Number.parseFloat(formState.amount)
            if (!Number.isFinite(amount) || amount <= 0) {
                setError('请输入有效的金额。')
                return
            }

            setIsSubmitting(true)
            setError(null)
            try {
                const payload = {
                    trip_id: selectedTripId,
                    amount,
                    currency: formState.currency ? formState.currency : undefined,
                    category: formState.category,
                    payment_method: formState.payment_method,
                    spent_at: formState.spent_at,
                    description: formState.description || undefined
                }
                const response = await fetch(
                    editingExpenseId ? `/api/expenses/${editingExpenseId}` : '/api/expenses',
                    {
                        method: editingExpenseId ? 'PUT' : 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(payload)
                    }
                )
                if (!response.ok) {
                    const data = (await response.json().catch(() => ({}))) as { error?: string }
                    throw new Error(data.error ?? '保存费用失败。')
                }
                const data = (await response.json()) as { data: ExpenseRecord }
                const saved = data.data
                setExpenses(prev => {
                    if (editingExpenseId) {
                        return prev.map(item => (item.id === editingExpenseId ? saved : item))
                    }
                    return [saved, ...prev]
                })
                void fetchStats()
                resetForm()
            } catch (err) {
                console.error(err)
                setError(err instanceof Error ? err.message : '保存费用失败，请稍后再试。')
            } finally {
                setIsSubmitting(false)
            }
        },
        [editingExpenseId, fetchStats, formState, resetForm, selectedTripId]
    )

    const handleEdit = useCallback((record: ExpenseRecord) => {
        setEditingExpenseId(record.id)
        setFormState({
            amount: record.amount.toString(),
            currency: record.currency ?? 'CNY',
            category: record.category,
            payment_method: record.payment_method,
            spent_at: record.spent_at.slice(0, 10),
            description: record.description ?? ''
        })
    }, [])

    const handleDelete = useCallback(
        async (record: ExpenseRecord) => {
            const confirmed = window.confirm(
                `确认删除 ${formatAmount(record.amount, record.currency)} · ${CATEGORY_LOOKUP[record.category]}?`
            )
            if (!confirmed) return
            try {
                const response = await fetch(`/api/expenses/${record.id}`, { method: 'DELETE' })
                if (!response.ok) {
                    const data = (await response.json().catch(() => ({}))) as { error?: string }
                    throw new Error(data.error ?? '删除失败。')
                }
                setExpenses(prev => prev.filter(item => item.id !== record.id))
                void fetchStats()
            } catch (err) {
                console.error(err)
                setError(err instanceof Error ? err.message : '删除费用失败。')
            }
        },
        [fetchStats]
    )

    const handleExportExcel = useCallback(() => {
        if (!selectedTrip || expenses.length === 0) {
            return
        }
        const workbook = XLSX.utils.book_new()
        const rawData = expenses.map(item => ({
            ID: item.id,
            金额: item.amount,
            货币: item.currency ?? 'CNY',
            类别: CATEGORY_LOOKUP[item.category],
            支付方式: PAYMENT_LOOKUP[item.payment_method],
            日期: item.spent_at,
            备注: item.description ?? '',
            创建时间: item.created_at,
            更新时间: item.updated_at ?? ''
        }))
        const rawSheet = XLSX.utils.json_to_sheet(rawData)
        XLSX.utils.book_append_sheet(workbook, rawSheet, '费用明细')

        if (stats) {
            const statSheet = XLSX.utils.json_to_sheet([
                {
                    总支出: stats.totalSpent,
                    预算: stats.budgetTotal ?? '',
                    差额: stats.budgetDelta ?? ''
                }
            ])
            XLSX.utils.book_append_sheet(workbook, statSheet, '预算汇总')

            const byCategorySheet = XLSX.utils.json_to_sheet(
                stats.byCategory.map(item => ({
                    类别: CATEGORY_LOOKUP[item.category],
                    金额: item.amount,
                    笔数: item.count,
                    占比: `${(item.ratio * 100).toFixed(2)}%`
                }))
            )
            XLSX.utils.book_append_sheet(workbook, byCategorySheet, '按类别统计')

            const byDateSheet = XLSX.utils.json_to_sheet(
                stats.byDate.map(item => ({ 日期: item.date, 金额: item.amount }))
            )
            XLSX.utils.book_append_sheet(workbook, byDateSheet, '按日期统计')
        }

        const arrayBuffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' })
        const fileName = `${selectedTrip.city}_行程支出_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`
        downloadBlob(
            arrayBuffer,
            fileName,
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    }, [expenses, selectedTrip, stats])

    const handleExportCsv = useCallback(() => {
        if (!selectedTrip || expenses.length === 0) {
            return
        }
        const header = '金额,货币,类别,支付方式,日期,备注\n'
        const rows = expenses
            .map(item => {
                const description = (item.description ?? '').replace(/"/g, '""')
                return [
                    item.amount.toFixed(2),
                    item.currency ?? 'CNY',
                    CATEGORY_LOOKUP[item.category],
                    PAYMENT_LOOKUP[item.payment_method],
                    item.spent_at,
                    `"${description}"`
                ].join(',')
            })
            .join('\n')
        const fileName = `${selectedTrip.city}_行程支出_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`
        downloadBlob(`${header}${rows}`, fileName, 'text/csv;charset=utf-8')
    }, [expenses, selectedTrip])

    const handleExportReport = useCallback(() => {
        if (!selectedTrip || expenses.length === 0) {
            return
        }
        const summaryLines = [`<h1>旅行费用报告</h1>`, `<p>生成时间：${format(new Date(), 'yyyy-MM-dd HH:mm')}</p>`]
        summaryLines.push(
            `<p>行程：${selectedTrip.city}（${selectedTrip.start_date} - ${selectedTrip.end_date}）</p>`
        )
        const plannedBudget = parseBudgetValue(selectedTrip.budget?.total)
        if (plannedBudget !== null) {
            summaryLines.push(
                `<p>原始预算：${formatAmount(plannedBudget, selectedTrip.budget?.currency ?? 'CNY')}</p>`
            )
        }
        if (stats) {
            summaryLines.push(
                `<p>总支出：${formatAmount(stats.totalSpent)}</p>`,
                stats.budgetTotal !== null && stats.budgetTotal !== undefined
                    ? `<p>预算：${formatAmount(stats.budgetTotal)}，差额：${formatAmount(stats.budgetDelta ?? 0)}</p>`
                    : ''
            )
            summaryLines.push('<h2>按类别统计</h2>')
            summaryLines.push(
                '<ul>' +
                stats.byCategory
                    .map(
                        item =>
                            `<li>${CATEGORY_LOOKUP[item.category]}：${formatAmount(item.amount)} · ${item.count} 笔 · ${(item.ratio * 100).toFixed(1)}%</li>`
                    )
                    .join('') +
                '</ul>'
            )
            summaryLines.push('<h2>按日期统计</h2>')
            summaryLines.push(
                '<ul>' +
                stats.byDate
                    .map(item => `<li>${item.date}：${formatAmount(item.amount)}</li>`)
                    .join('') +
                '</ul>'
            )
        }
        summaryLines.push('<h2>费用明细</h2>')
        summaryLines.push(
            '<ul>' +
            expenses
                .map(
                    item =>
                        `<li>${item.spent_at} · ${formatAmount(item.amount, item.currency)} · ${CATEGORY_LOOKUP[item.category]} · ${PAYMENT_LOOKUP[item.payment_method]
                        }${item.description ? ` · ${item.description}` : ''}</li>`
                )
                .join('') +
            '</ul>'
        )
        const fileName = `${selectedTrip.city}_费用报告_${format(new Date(), 'yyyyMMdd_HHmm')}.html`
        downloadBlob(summaryLines.join(''), fileName, 'text/html;charset=utf-8')
    }, [expenses, selectedTrip, stats])

    const handleVoiceStart = useCallback(async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error('当前浏览器不支持麦克风录音。')
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaStreamRef.current = stream
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
            audioChunksRef.current = []
            recorder.ondataavailable = event => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }
            recorder.onstop = async () => {
                try {
                    setVoiceStatus('processing')
                    const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
                    const { base64, sampleRate } = await convertBlobToPcmBase64(blob, TARGET_SAMPLE_RATE)
                    const response = await fetch('/api/transcribe/iflytek', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ pcm: base64, sampleRate })
                    })
                    if (!response.ok) {
                        const payload = (await response.json().catch(() => ({}))) as { error?: string }
                        throw new Error(payload.error ?? '语音识别失败。')
                    }
                    const data = (await response.json()) as { transcript?: string }
                    const transcript = data.transcript ?? ''
                    if (!transcript) {
                        throw new Error('未识别到语音内容，请重试。')
                    }
                    const parsed = parseExpenseFromTranscript(transcript)
                    const spentAt = selectedTrip ? clampDateToTrip(parsed.spent_at, selectedTrip) : parsed.spent_at
                    setFormState(prev => ({
                        ...prev,
                        amount: parsed.amount || prev.amount,
                        category: parsed.category,
                        payment_method: parsed.payment_method,
                        spent_at: spentAt,
                        description: parsed.description
                    }))
                    setVoiceStatus('idle')
                    setVoiceError(null)
                } catch (err) {
                    console.error(err)
                    setVoiceStatus('error')
                    setVoiceError(err instanceof Error ? err.message : '语音处理失败。')
                } finally {
                    mediaStreamRef.current?.getTracks().forEach(track => track.stop())
                    mediaStreamRef.current = null
                }
            }
            mediaRecorderRef.current = recorder
            recorder.start()
            setVoiceStatus('recording')
            setVoiceError(null)
        } catch (err) {
            console.error(err)
            setVoiceStatus('error')
            setVoiceError(err instanceof Error ? err.message : '麦克风启动失败。')
        }
    }, [selectedTrip])

    const handleVoiceStop = useCallback(() => {
        mediaRecorderRef.current?.stop()
        setVoiceStatus('processing')
    }, [])

    useEffect(() => {
        return () => {
            mediaRecorderRef.current?.stop()
            mediaStreamRef.current?.getTracks().forEach(track => track.stop())
        }
    }, [])

    const categoryChartData = useMemo(() => stats?.byCategory ?? [], [stats])
    const dateChartData = useMemo(() => stats?.byDate ?? [], [stats])

    const fallbackBudget = useMemo(() => parseBudgetValue(selectedTrip?.budget?.total), [selectedTrip])
    const totalSpent = stats?.totalSpent ?? expenses.reduce((total, item) => total + item.amount, 0)
    const budgetTotal = stats?.budgetTotal ?? fallbackBudget
    const budgetDelta =
        stats?.budgetDelta ?? (budgetTotal !== null && budgetTotal !== undefined ? Number((budgetTotal - totalSpent).toFixed(2)) : null)
    const completionRatio = budgetTotal && budgetTotal > 0 ? totalSpent / budgetTotal : null
    const exportDisabled = !selectedTrip || expenses.length === 0

    const tripSummary = useMemo(() => {
        if (!selectedTrip) return '请选择行程以开始记录支出。'
        const dayCount = selectedTrip.days?.length ?? 0
        const description = `${selectedTrip.city} · ${selectedTrip.start_date} - ${selectedTrip.end_date}`
        if (dayCount > 0) {
            return `${description} · 共 ${dayCount} 天`
        }
        return description
    }, [selectedTrip])

    return (
        <ProtectedClient>
            <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
                <header className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900">预算中心</h1>
                        <p className="mt-2 text-sm text-slate-500">
                            请选择行程后记录支出，实时对比原始预算，并可语音录入与多格式导出。
                        </p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        <button
                            type="button"
                            onClick={handleExportExcel}
                            disabled={exportDisabled}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            导出 Excel
                        </button>
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            disabled={exportDisabled}
                            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            导出 CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportReport}
                            disabled={exportDisabled}
                            className="inline-flex items-center rounded-full border border-blue-500 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm transition hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            导出费用报告
                        </button>
                    </div>
                </header>

                <section className="mb-8 space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                        <header className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-semibold text-slate-900">选择行程</h2>
                                <p className="text-xs text-slate-500">所有费用与分析均基于所选行程计算。</p>
                            </div>
                        </header>
                        {tripError ? (
                            <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{tripError}</p>
                        ) : null}
                        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center">
                            <select
                                value={selectedTripId ?? ''}
                                onChange={event => setSelectedTripId(event.target.value || null)}
                                disabled={isTripLoading || trips.length === 0}
                                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 lg:w-80"
                            >
                                <option value="">{isTripLoading ? '正在加载行程…' : '请选择行程'}</option>
                                {trips.map(trip => (
                                    <option key={trip.id} value={trip.id}>
                                        {trip.city} · {trip.start_date} - {trip.end_date}
                                    </option>
                                ))}
                            </select>
                            <div className="text-sm text-slate-500">{tripSummary}</div>
                        </div>
                        {selectedTrip?.budget?.total ? (
                            <p className="mt-3 text-xs text-slate-500">
                                原始预算：
                                {formatAmount(
                                    parseBudgetValue(selectedTrip.budget.total) ?? 0,
                                    selectedTrip.budget.currency ?? 'CNY'
                                )}
                                {selectedTrip.budget.notes ? ` · ${selectedTrip.budget.notes}` : ''}
                            </p>
                        ) : null}
                    </div>

                    {!selectedTrip && !isTripLoading ? (
                        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center text-sm text-slate-500">
                            <p>当前暂无行程，请先前往行程管理创建或选择行程后再进行预算记录。</p>
                            <a
                                href="/itineraries"
                                className="mt-4 inline-flex items-center rounded-full border border-blue-500 px-4 py-2 text-xs font-medium text-blue-600 transition hover:bg-blue-50"
                            >
                                前往行程列表
                            </a>
                        </div>
                    ) : null}
                </section>

                {!selectedTrip ? null : (
                    <>
                        <section className="grid gap-6 lg:grid-cols-[2fr,1fr]">
                            <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <header className="flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h2 className="text-lg font-semibold text-slate-900">
                                            {editingExpenseId ? '编辑费用' : '新增费用'}
                                        </h2>
                                        <p className="text-xs text-slate-500">
                                            支持语音自动填写金额、类别、日期与支付方式。
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => (voiceStatus === 'recording' ? handleVoiceStop() : handleVoiceStart())}
                                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-medium shadow transition ${voiceStatus === 'recording'
                                                    ? 'border border-red-500 bg-red-50 text-red-600'
                                                    : 'border border-emerald-500 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                                                }`}
                                        >
                                            {voiceStatus === 'recording' ? '停止语音录入' : '语音输入'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={resetForm}
                                            className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-300"
                                        >
                                            重置
                                        </button>
                                    </div>
                                </header>
                                {voiceStatus === 'processing' ? (
                                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-600">正在处理语音，请稍候…</p>
                                ) : null}
                                {voiceStatus === 'error' && voiceError ? (
                                    <p className="rounded-md bg-red-50 px-3 py-2 text-xs text-red-600">{voiceError}</p>
                                ) : null}

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <label className="text-sm font-medium text-slate-700">
                                        金额
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={formState.amount}
                                            onChange={event => handleFormChange('amount', event.target.value)}
                                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            placeholder="例如 128.50"
                                        />
                                    </label>
                                    <label className="text-sm font-medium text-slate-700">
                                        货币
                                        <input
                                            type="text"
                                            value={formState.currency}
                                            onChange={event => handleFormChange('currency', event.target.value.toUpperCase())}
                                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                            placeholder="默认 CNY"
                                        />
                                    </label>
                                    <label className="text-sm font-medium text-slate-700">
                                        类别
                                        <select
                                            value={formState.category}
                                            onChange={event => handleFormChange('category', event.target.value as ExpenseCategoryKey)}
                                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        >
                                            {EXPENSE_CATEGORIES.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="text-sm font-medium text-slate-700">
                                        支付方式
                                        <select
                                            value={formState.payment_method}
                                            onChange={event =>
                                                handleFormChange('payment_method', event.target.value as PaymentMethodKey)
                                            }
                                            className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        >
                                            {PAYMENT_METHODS.map(option => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    <label className="text-sm font-medium text-slate-700">
                                        日期
                                        <input
                                            type="date"
                                            value={formState.spent_at}
                                            min={selectedTrip.start_date}
                                            max={selectedTrip.end_date}
                                            onChange={event => handleFormChange('spent_at', event.target.value)}
                                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </label>
                                    <label className="text-sm font-medium text-slate-700 sm:col-span-2">
                                        备注
                                        <textarea
                                            value={formState.description}
                                            onChange={event => handleFormChange('description', event.target.value)}
                                            rows={3}
                                            placeholder="支持语音填充，亦可手写补充，如“机场快线，包含行李寄存”。"
                                            className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                                        />
                                    </label>
                                </div>

                                <div className="flex items-center gap-3">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="inline-flex items-center rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
                                    >
                                        {isSubmitting ? '保存中…' : editingExpenseId ? '保存修改' : '添加费用'}
                                    </button>
                                    <p className="text-xs text-slate-400">
                                        语音识别可提取金额（数字）、类别（如餐饮）、日期（如11月5日）、支付方式（如信用卡）。
                                    </p>
                                </div>
                            </form>

                            <aside className="space-y-6">
                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-900">预算执行概览</h3>
                                    <dl className="mt-4 space-y-2 text-sm text-slate-600">
                                        <div className="flex items-center justify-between">
                                            <dt>总支出</dt>
                                            <dd className="font-semibold text-slate-900">{formatAmount(totalSpent)}</dd>
                                        </div>
                                        {budgetTotal !== null && budgetTotal !== undefined ? (
                                            <div className="flex items-center justify-between">
                                                <dt>既定预算</dt>
                                                <dd>{formatAmount(budgetTotal)}</dd>
                                            </div>
                                        ) : null}
                                        {budgetDelta !== null ? (
                                            <div className="flex items-center justify-between">
                                                <dt>与预算差额</dt>
                                                <dd className={budgetDelta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                                                    {formatAmount(budgetDelta)}
                                                </dd>
                                            </div>
                                        ) : null}
                                        {completionRatio !== null ? (
                                            <div className="flex items-center justify-between">
                                                <dt>完成度</dt>
                                                <dd>{Math.min(100, completionRatio * 100).toFixed(1)}%</dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                </div>

                                <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                    <h3 className="text-sm font-semibold text-slate-900">筛选条件</h3>
                                    <div className="mt-4 space-y-4 text-sm text-slate-600">
                                        <label className="block">
                                            <span className="text-xs font-medium text-slate-500">类别</span>
                                            <select
                                                value={filters.category}
                                                onChange={event =>
                                                    setFilters(prev => ({
                                                        ...prev,
                                                        category: event.target.value as ExpenseFilters['category']
                                                    }))
                                                }
                                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                                            >
                                                <option value="all">全部</option>
                                                {EXPENSE_CATEGORIES.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <label className="block">
                                            <span className="text-xs font-medium text-slate-500">支付方式</span>
                                            <select
                                                value={filters.payment_method}
                                                onChange={event =>
                                                    setFilters(prev => ({
                                                        ...prev,
                                                        payment_method: event.target.value as ExpenseFilters['payment_method']
                                                    }))
                                                }
                                                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2"
                                            >
                                                <option value="all">全部</option>
                                                {PAYMENT_METHODS.map(option => (
                                                    <option key={option.value} value={option.value}>
                                                        {option.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </label>
                                        <div className="grid grid-cols-2 gap-3">
                                            <label className="block text-xs font-medium text-slate-500">
                                                开始日期
                                                <input
                                                    type="date"
                                                    value={filters.start_date ?? ''}
                                                    min={selectedTrip.start_date}
                                                    max={selectedTrip.end_date}
                                                    onChange={event =>
                                                        setFilters(prev => ({
                                                            ...prev,
                                                            start_date: event.target.value ? event.target.value : null
                                                        }))
                                                    }
                                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                                                />
                                            </label>
                                            <label className="block text-xs font-medium text-slate-500">
                                                结束日期
                                                <input
                                                    type="date"
                                                    value={filters.end_date ?? ''}
                                                    min={selectedTrip.start_date}
                                                    max={selectedTrip.end_date}
                                                    onChange={event =>
                                                        setFilters(prev => ({
                                                            ...prev,
                                                            end_date: event.target.value ? event.target.value : null
                                                        }))
                                                    }
                                                    className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2"
                                                />
                                            </label>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() =>
                                                setFilters({ category: 'all', payment_method: 'all', start_date: null, end_date: null })
                                            }
                                            className="w-full rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-500 transition hover:border-slate-300"
                                        >
                                            清空筛选
                                        </button>
                                    </div>
                                </div>
                            </aside>
                        </section>

                        <section className="mt-8 grid gap-6 lg:grid-cols-2">
                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="text-sm font-semibold text-slate-900">类别占比</h3>
                                <div className="mt-4 h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Tooltip
                                                formatter={(value: number, _name: string, entry: any) =>
                                                    `${CATEGORY_LOOKUP[(entry.payload as CategoryStat).category]}：${formatAmount(value)}`
                                                }
                                            />
                                            <Pie
                                                data={categoryChartData}
                                                dataKey="amount"
                                                nameKey="category"
                                                innerRadius={60}
                                                outerRadius={100}
                                                paddingAngle={4}
                                            >
                                                {categoryChartData.map(item => (
                                                    <Cell
                                                        key={item.category}
                                                        fill={CATEGORY_COLOR_LOOKUP[item.category] ?? '#2563eb'}
                                                    />
                                                ))}
                                            </Pie>
                                            <Legend
                                                formatter={(value: string) => CATEGORY_LOOKUP[value as ExpenseCategoryKey]}
                                                verticalAlign="bottom"
                                                height={36}
                                            />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                                <h3 className="text-sm font-semibold text-slate-900">每日支出</h3>
                                <div className="mt-4 h-72">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <BarChart data={dateChartData}>
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                                            <YAxis tick={{ fontSize: 12 }} />
                                            <Tooltip formatter={(value: number) => formatAmount(value)} />
                                            <Bar dataKey="amount" fill="#2563eb" radius={[6, 6, 0, 0]} />
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                        </section>

                        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                            <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <h3 className="text-lg font-semibold text-slate-900">费用记录</h3>
                                    <p className="text-xs text-slate-500">
                                        共 {expenses.length} 条记录，支持点击编辑或删除。
                                    </p>
                                </div>
                            </header>
                            {error ? (
                                <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">{error}</p>
                            ) : null}
                            {isLoading ? (
                                <p className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-500">正在加载费用数据…</p>
                            ) : expenses.length === 0 ? (
                                <p className="rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-500">
                                    暂无费用记录，可通过上方表单添加或语音输入。
                                </p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-slate-200 text-sm">
                                        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                                            <tr>
                                                <th className="px-3 py-2">日期</th>
                                                <th className="px-3 py-2">类别</th>
                                                <th className="px-3 py-2">金额</th>
                                                <th className="px-3 py-2">支付方式</th>
                                                <th className="px-3 py-2">备注</th>
                                                <th className="px-3 py-2 text-right">操作</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100 text-slate-700">
                                            {expenses.map(item => (
                                                <tr key={item.id} className="transition hover:bg-slate-50/60">
                                                    <td className="px-3 py-2 text-xs text-slate-500">{item.spent_at}</td>
                                                    <td className="px-3 py-2 font-medium text-slate-900">{CATEGORY_LOOKUP[item.category]}</td>
                                                    <td className="px-3 py-2 font-semibold text-slate-900">
                                                        {formatAmount(item.amount, item.currency)}
                                                    </td>
                                                    <td className="px-3 py-2 text-xs text-slate-500">{PAYMENT_LOOKUP[item.payment_method]}</td>
                                                    <td className="px-3 py-2 text-xs text-slate-500">
                                                        {item.description ? item.description : '—'}
                                                    </td>
                                                    <td className="px-3 py-2 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleEdit(item)}
                                                                className="rounded-full border border-slate-200 px-3 py-1 text-xs font-medium text-slate-600 transition hover:border-slate-300"
                                                            >
                                                                编辑
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelete(item)}
                                                                className="rounded-full border border-red-500 px-3 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50"
                                                            >
                                                                删除
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </section>
                    </>
                )}
            </div>
        </ProtectedClient>
    )
}
