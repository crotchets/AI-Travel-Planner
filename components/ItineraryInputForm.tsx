"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'

import type { TripPlanRecord, TripRequest } from '../types/trip'

type TripRequestFormState = {
    city: string
    start_date: string
    end_date: string
    travel_days: string
    transportation: string
    accommodation: string
    preferences: string
    budget_level: string
    free_text_input: string
}

const TRIP_FORM_TRANSPORTATION_OPTIONS = [
    { value: 'public', label: '公共交通' },
    { value: 'self-driving', label: '自驾' },
    { value: 'walking', label: '步行' },
    { value: 'mixed', label: '综合出行' }
]

const TRIP_FORM_ACCOMMODATION_OPTIONS = [
    { value: 'budget', label: '经济型' },
    { value: 'boutique', label: '精品/设计' },
    { value: 'family', label: '亲子友好' },
    { value: 'business', label: '商务舒适' },
    { value: 'luxury', label: '高端奢华' }
]

const TRIP_FORM_BUDGET_LEVEL_OPTIONS = [
    { value: 'economy', label: '经济型' },
    { value: 'moderate', label: '适中' },
    { value: 'premium', label: '高消费' }
]

const TRIP_FORM_PREFERENCE_SEPARATORS = /[\n,，；;]+/

const MAX_CHARS = 800

const TARGET_SAMPLE_RATE = 16000

function normalizeTripRequestPreferences(value: string): string[] {
    return value
        .split(TRIP_FORM_PREFERENCE_SEPARATORS)
        .map(item => item.trim())
        .filter(Boolean)
}

function toTripRequestFormState(request: TripRequest | null | undefined): TripRequestFormState {
    return {
        city: request?.city ?? '',
        start_date: request?.start_date ?? '',
        end_date: request?.end_date ?? '',
        travel_days: request?.travel_days?.toString() ?? '',
        transportation: request?.transportation ?? '',
        accommodation: request?.accommodation ?? '',
        preferences: request?.preferences?.join(', ') ?? '',
        budget_level: request?.budget_level ?? '',
        free_text_input: request?.free_text_input ?? ''
    }
}

function tripRequestHasInput(form: TripRequestFormState): boolean {
    return Object.values(form).some(value => value.trim().length > 0)
}

function buildTripRequestPayload(form: TripRequestFormState, options?: { allowPartial?: boolean }): TripRequest | null {
    const allowPartial = options?.allowPartial ?? false

    const city = form.city.trim()
    const startDate = form.start_date.trim()
    const endDate = form.end_date.trim()

    const hasCoreFields = city !== '' || startDate !== '' || endDate !== ''

    if (!hasCoreFields) {
        return allowPartial ? null : (() => {
            throw new Error('TripRequest 至少需要提供目的地城市与出行日期。')
        })()
    }

    if (!city || !startDate || !endDate) {
        if (allowPartial) {
            return null
        }

        const missing = [
            !city ? '目的地城市' : null,
            !startDate ? '开始日期' : null,
            !endDate ? '结束日期' : null
        ].filter(Boolean)

        throw new Error(`TripRequest 缺少字段：${missing.join('、')}。`)
    }

    const payload: TripRequest = {
        city,
        start_date: startDate,
        end_date: endDate
    }

    const travelDaysRaw = form.travel_days.trim()
    if (travelDaysRaw) {
        const travelDays = Number.parseInt(travelDaysRaw, 10)
        if (!Number.isNaN(travelDays) && travelDays > 0) {
            payload.travel_days = travelDays
        }
    }

    const transportation = form.transportation.trim()
    if (transportation) {
        payload.transportation = transportation as TripRequest['transportation']
    }

    const accommodation = form.accommodation.trim()
    if (accommodation) {
        payload.accommodation = accommodation as TripRequest['accommodation']
    }

    const preferences = normalizeTripRequestPreferences(form.preferences)
    if (preferences.length) {
        payload.preferences = preferences
    }

    const budgetLevel = form.budget_level.trim()
    if (budgetLevel) {
        payload.budget_level = budgetLevel as TripRequest['budget_level']
    }

    const freeText = form.free_text_input.trim()
    if (freeText) {
        payload.free_text_input = freeText
    }

    return payload
}

function getAudioContextConstructor(): typeof AudioContext {
    if (typeof window === 'undefined') {
        throw new Error('当前环境不支持音频处理。')
    }

    const ctor = window.AudioContext ?? (window as any).webkitAudioContext
    if (!ctor) {
        throw new Error('当前浏览器不支持音频处理。')
    }

    return ctor as typeof AudioContext
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
    const AudioContextCtor = getAudioContextConstructor()
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

type SpeechRecognitionType = any

type SpeechProvider = 'browser' | 'iflytek'

type DashboardItineraryInputFormProps = {
    onPlanCreated?: (record: TripPlanRecord) => Promise<void> | void
}

export default function ItineraryInputForm({ onPlanCreated }: DashboardItineraryInputFormProps) {
    const [prompt, setPrompt] = useState('')
    const [requestForm, setRequestForm] = useState<TripRequestFormState>(() => toTripRequestFormState(null))
    const [error, setError] = useState<string | null>(null)
    const [successMessage, setSuccessMessage] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [speechProvider, setSpeechProvider] = useState<SpeechProvider>('browser')
    const [isUploadingAudio, setIsUploadingAudio] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const [isExtracting, setIsExtracting] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const recognitionRef = useRef<SpeechRecognitionType | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioChunksRef = useRef<Blob[]>([])

    const remaining = MAX_CHARS - prompt.length
    const partialRequest = useMemo(() => buildTripRequestPayload(requestForm, { allowPartial: true }), [requestForm])

    const canExtract = prompt.trim().length > 0 && !isExtracting && !isUploadingAudio
    const canGenerate = Boolean(partialRequest) && !isGenerating && !isUploadingAudio

    const updateRequestField = useCallback((key: keyof TripRequestFormState, value: string) => {
        setRequestForm(prev => ({ ...prev, [key]: value }))
        setError(null)
        setSuccessMessage(null)
    }, [])

    const handleResetForm = useCallback(() => {
        setRequestForm(toTripRequestFormState(null))
        setError(null)
        setSuccessMessage(null)
    }, [])

    const stopBrowserRecognition = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
            recognitionRef.current = null
        }
        setIsRecording(false)
    }, [])

    const stopIflytekRecording = useCallback(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try {
                mediaRecorderRef.current.stop()
            } catch (err) {
                console.error('stop media recorder failed', err)
            }
        }
        mediaRecorderRef.current = null
        if (mediaStreamRef.current) {
            mediaStreamRef.current.getTracks().forEach(track => track.stop())
            mediaStreamRef.current = null
        }
        setIsRecording(false)
    }, [])

    const stopActiveRecording = useCallback(() => {
        if (speechProvider === 'browser') {
            stopBrowserRecognition()
        } else {
            stopIflytekRecording()
        }
    }, [speechProvider, stopBrowserRecognition, stopIflytekRecording])

    useEffect(() => {
        return () => {
            stopActiveRecording()
        }
    }, [stopActiveRecording])

    const startBrowserRecognition = useCallback(() => {
        if (typeof window === 'undefined') return
        const RecognitionCtor =
            (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition

        if (!RecognitionCtor) {
            setError('当前浏览器不支持语音识别，请改用文字输入。')
            return
        }

        try {
            const recognition: SpeechRecognitionType = new RecognitionCtor()
            recognition.lang = 'zh-CN'
            recognition.continuous = false
            recognition.interimResults = false

            recognition.onresult = (event: any) => {
                const transcript = Array.from(event.results)
                    .map((result: any) => result[0]?.transcript ?? '')
                    .join(' ')
                setPrompt(prev => {
                    const merged = `${prev ? prev + '\n' : ''}${transcript}`
                    return merged.slice(0, MAX_CHARS)
                })
            }

            recognition.onend = () => {
                recognitionRef.current = null
                setIsRecording(false)
            }

            recognition.onerror = (event: any) => {
                console.error('speech error', event?.error)
                recognitionRef.current = null
                setIsRecording(false)
                setError('语音识别过程中出现问题，请重试或改用文字输入。')
            }

            recognitionRef.current = recognition
            setIsRecording(true)
            setError(null)
            setSuccessMessage(null)
            recognition.start()
        } catch (err) {
            console.error(err)
            setError('无法启动语音识别，请检查麦克风权限或浏览器设置。')
            setIsRecording(false)
        }
    }, [])

    const startIflytekRecording = useCallback(async () => {
        if (typeof window === 'undefined') return
        if (typeof MediaRecorder === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
            setError('当前浏览器不支持麦克风录音，请改用文字输入。')
            return
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
            mediaStreamRef.current = stream
            const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' })
            audioChunksRef.current = []

            recorder.ondataavailable = event => {
                if (event.data && event.data.size > 0) {
                    audioChunksRef.current.push(event.data)
                }
            }

            recorder.onerror = event => {
                console.error('media recorder error', event)
                setError('录音过程中出现问题，请重试或检查麦克风权限。')
                setIsRecording(false)
                stopIflytekRecording()
            }

            recorder.onstop = async () => {
                mediaRecorderRef.current = null
                const chunks = audioChunksRef.current
                audioChunksRef.current = []
                const currentStream = mediaStreamRef.current
                if (currentStream) {
                    currentStream.getTracks().forEach(track => track.stop())
                    mediaStreamRef.current = null
                }

                setIsRecording(false)

                if (!chunks.length) {
                    setStatusMessage(null)
                    return
                }

                const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' })
                if (!blob.size) {
                    setStatusMessage(null)
                    return
                }

                setIsUploadingAudio(true)
                setError(null)

                try {
                    setStatusMessage('音频处理中…')
                    const { base64, sampleRate } = await convertBlobToPcmBase64(blob, TARGET_SAMPLE_RATE)
                    setStatusMessage('讯飞转写中，请稍候…')

                    const response = await fetch('/api/transcribe/iflytek', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            audio: base64,
                            sampleRate
                        })
                    })

                    if (!response.ok) {
                        const message = await response.text()
                        throw new Error(message || '讯飞转写接口调用失败')
                    }

                    const data = await response.json()
                    const transcript = typeof data?.transcript === 'string' ? data.transcript : ''

                    if (!transcript) {
                        throw new Error('讯飞转写未返回文本结果')
                    }

                    setPrompt(prev => {
                        const merged = `${prev ? prev + '\n' : ''}${transcript}`
                        return merged.slice(0, MAX_CHARS)
                    })
                } catch (err) {
                    console.error(err)
                    const message = err instanceof Error ? err.message : '调用讯飞转写失败，请稍后再试或改用文字输入。'
                    setError(message)
                } finally {
                    setIsUploadingAudio(false)
                    setStatusMessage(null)
                }
            }

            mediaRecorderRef.current = recorder
            setIsRecording(true)
            setError(null)
            setSuccessMessage(null)
            recorder.start()
        } catch (err) {
            console.error(err)
            setError('无法启动麦克风录音，请检查权限设置。')
            stopIflytekRecording()
        }
    }, [stopIflytekRecording])

    const startVoiceInput = useCallback(async () => {
        if (speechProvider === 'browser') {
            startBrowserRecognition()
            return
        }

        await startIflytekRecording()
    }, [speechProvider, startBrowserRecognition, startIflytekRecording])

    const handleProviderChange = useCallback(
        (provider: SpeechProvider) => {
            if (provider === speechProvider || isUploadingAudio) return
            stopActiveRecording()
            setSpeechProvider(provider)
            setStatusMessage(null)
            setError(null)
            setSuccessMessage(null)
        },
        [isUploadingAudio, speechProvider, stopActiveRecording]
    )

    const handleExtract = useCallback(async () => {
        if (!prompt.trim()) {
            setError('请先输入或录制旅行描述，再尝试解析。')
            return
        }
        setError(null)
        setSuccessMessage(null)
        setIsExtracting(true)
        try {
            const response = await fetch('/api/trip-request/extract', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: prompt.trim() })
            })
            const payload = await response.json()
            if (!response.ok) {
                throw new Error(payload?.error || '解析旅行需求失败。')
            }
            const extracted = payload?.data as TripRequest | null | undefined
            if (!extracted || !tripRequestHasInput(toTripRequestFormState(extracted))) {
                throw new Error('未能从描述中提取到有效字段，请手动填写表单。')
            }
            setRequestForm(toTripRequestFormState(extracted))
            setSuccessMessage('已根据描述填充表单，请检查并补全缺失字段。')
        } catch (err) {
            console.error(err)
            setError(err instanceof Error ? err.message : '解析旅行需求时出现错误。')
        } finally {
            setIsExtracting(false)
        }
    }, [prompt])

    const handleGenerate = useCallback(
        async (event?: FormEvent) => {
            event?.preventDefault()
            setError(null)
            setSuccessMessage(null)

            let tripRequest: TripRequest
            try {
                tripRequest = buildTripRequestPayload(requestForm) as TripRequest
            } catch (err) {
                setError(err instanceof Error ? err.message : 'TripRequest 数据不完整。')
                return
            }

            setIsGenerating(true)
            try {
                const response = await fetch('/api/planner/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ request: tripRequest, prompt: prompt.trim() || undefined })
                })
                const payload = await response.json()
                if (!response.ok) {
                    throw new Error(payload?.error || '调用行程生成服务失败。')
                }
                const record = payload?.data as TripPlanRecord | undefined
                if (!record) {
                    throw new Error('生成成功但未返回行程数据。')
                }
                setSuccessMessage('行程已生成并保存到 Supabase，可前往“我的行程”查看。')
                setRequestForm(toTripRequestFormState(tripRequest))
                if (prompt.trim().length > 0) {
                    setPrompt('')
                }
                onPlanCreated?.(record)
            } catch (err) {
                console.error(err)
                setError(err instanceof Error ? err.message : '生成行程时出现错误。')
            } finally {
                setIsGenerating(false)
            }
        },
        [onPlanCreated, prompt, requestForm]
    )

    const helperText = useMemo(() => {
        if (remaining < 0) return '已超出限制字符数，请精简描述。'
        return `还可以输入 ${remaining} 个字符（建议描述目的地、日期、预算、偏好等信息）`
    }, [remaining])

    return (
        <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="mb-4">
                <h3 className="text-lg font-semibold text-slate-900">创建新行程</h3>
                <p className="mt-1 text-sm text-slate-500">
                    语音或文字描述你的旅行需求，我们会为你生成个性化行程规划。
                </p>
                <p className="mt-1 text-xs text-slate-400">
                    先解析 TripRequest 字段，再调用阿里云百炼模型生成 TripPlan 并自动保存到 Supabase。
                </p>
            </header>

            {error ? <p className="mb-3 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
            {successMessage ? (
                <p className="mb-3 rounded bg-emerald-50 px-3 py-2 text-sm text-emerald-600">{successMessage}</p>
            ) : null}

            <form onSubmit={handleGenerate} className="space-y-6">
                <div>
                    <label className="mb-2 block text-sm font-medium text-slate-700">旅行需求描述</label>
                    <textarea
                        value={prompt}
                        onChange={event => {
                            if (event.target.value.length > MAX_CHARS) {
                                setPrompt(event.target.value.slice(0, MAX_CHARS))
                            } else {
                                setPrompt(event.target.value)
                            }
                        }}
                        rows={4}
                        placeholder="例如：我们两人想在 5 月份去杭州自由行 3 天，预算 5000 元，喜欢美食和自然，希望安排一天西湖。"
                        className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                    />
                    <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                        <span>{helperText}</span>
                        <div className="flex items-center gap-2">
                            {statusMessage ? <span className="text-blue-500">{statusMessage}</span> : null}
                            {isRecording ? <span className="text-red-500">正在录制语音…</span> : null}
                        </div>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>语音识别方式：</span>
                    <button
                        type="button"
                        onClick={() => handleProviderChange('browser')}
                        className={`rounded-full border px-3 py-1 transition ${speechProvider === 'browser'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600'
                            }`}
                    >
                        浏览器内置
                    </button>
                    <button
                        type="button"
                        onClick={() => handleProviderChange('iflytek')}
                        className={`rounded-full border px-3 py-1 transition ${speechProvider === 'iflytek'
                            ? 'border-blue-500 bg-blue-500/10 text-blue-600'
                            : 'border-slate-300 bg-white text-slate-600 hover:border-blue-400 hover:text-blue-600'
                            }`}
                    >
                        科大讯飞 API
                    </button>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <button
                        type="button"
                        onClick={() => {
                            if (isRecording) {
                                stopActiveRecording()
                            } else {
                                void startVoiceInput()
                            }
                        }}
                        disabled={isUploadingAudio}
                        className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition ${isRecording
                            ? 'border-red-200 bg-red-50 text-red-600'
                            : isUploadingAudio
                                ? 'border-slate-200 bg-slate-100 text-slate-400'
                                : 'border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:text-blue-600'
                            }`}
                    >
                        <span>
                            {isRecording
                                ? '停止录音'
                                : speechProvider === 'browser'
                                    ? '语音输入'
                                    : '录音并上传'}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={handleExtract}
                        disabled={!canExtract}
                        className="inline-flex items-center rounded-full border border-blue-500 px-4 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    >
                        {isExtracting ? '解析中…' : '解析描述填充表单'}
                    </button>
                </div>

                <div className="space-y-6">
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900">旅行需求</h3>
                        <p className="mt-1 text-xs text-slate-500">确认或修改自动填充的字段，必要时手动补全信息。</p>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                目的地城市 *
                            </span>
                            <input
                                type="text"
                                value={requestForm.city}
                                onChange={event => updateRequestField('city', event.target.value)}
                                placeholder="例如：杭州"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                行程开始日期 *
                            </span>
                            <input
                                type="date"
                                value={requestForm.start_date}
                                onChange={event => updateRequestField('start_date', event.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                行程结束日期 *
                            </span>
                            <input
                                type="date"
                                value={requestForm.end_date}
                                onChange={event => updateRequestField('end_date', event.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                行程天数（可选）
                            </span>
                            <input
                                type="number"
                                min={1}
                                value={requestForm.travel_days}
                                onChange={event => updateRequestField('travel_days', event.target.value)}
                                placeholder="例如：5"
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </label>
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                交通偏好（可选）
                            </span>
                            <select
                                value={requestForm.transportation}
                                onChange={event => updateRequestField('transportation', event.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                                <option value="">请选择交通偏好</option>
                                {TRIP_FORM_TRANSPORTATION_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                住宿偏好（可选）
                            </span>
                            <select
                                value={requestForm.accommodation}
                                onChange={event => updateRequestField('accommodation', event.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                                <option value="">请选择住宿偏好</option>
                                {TRIP_FORM_ACCOMMODATION_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                预算等级（可选）
                            </span>
                            <select
                                value={requestForm.budget_level}
                                onChange={event => updateRequestField('budget_level', event.target.value)}
                                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            >
                                <option value="">请选择预算等级</option>
                                {TRIP_FORM_BUDGET_LEVEL_OPTIONS.map(option => (
                                    <option key={option.value} value={option.value}>
                                        {option.label}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                兴趣偏好（可选）
                            </span>
                            <textarea
                                value={requestForm.preferences}
                                onChange={event => updateRequestField('preferences', event.target.value)}
                                rows={3}
                                placeholder="例如：美食、自然、摄影"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </label>
                        <p className="mt-1 text-xs text-slate-400">可使用逗号、分号或换行分隔多个偏好。</p>
                    </div>

                    <div>
                        <label className="flex flex-col gap-1 text-sm text-slate-600">
                            <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                                自由描述（可选）
                            </span>
                            <textarea
                                value={requestForm.free_text_input}
                                onChange={event => updateRequestField('free_text_input', event.target.value)}
                                rows={4}
                                placeholder="补充同行人、节奏、饮食等特殊要求"
                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200"
                            />
                        </label>
                    </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-2">
                    <button
                        type="submit"
                        disabled={!canGenerate}
                        className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {isGenerating ? '生成行程中…' : '生成行程并保存'}
                    </button>
                    <button
                        type="button"
                        onClick={handleResetForm}
                        disabled={isGenerating || isExtracting}
                        className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 disabled:cursor-not-allowed disabled:text-slate-400"
                    >
                        重置表单
                    </button>
                </div>
            </form>
        </section>
    )
}
