"use client"
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

type PlanningMode = 'idle' | 'thinking'

const MAX_CHARS = 800

type SpeechRecognitionType = any
type SpeechProvider = 'browser' | 'iflytek'

export default function ItineraryInputForm({
    onSubmit
}: {
    onSubmit?: (payload: { prompt: string; source: 'text' | 'voice' }) => Promise<void> | void
}) {
    const [prompt, setPrompt] = useState('')
    const [mode, setMode] = useState<PlanningMode>('idle')
    const [error, setError] = useState<string | null>(null)
    const [isRecording, setIsRecording] = useState(false)
    const [speechProvider, setSpeechProvider] = useState<SpeechProvider>('browser')
    const [isUploadingAudio, setIsUploadingAudio] = useState(false)
    const [statusMessage, setStatusMessage] = useState<string | null>(null)
    const recognitionRef = useRef<SpeechRecognitionType | null>(null)
    const mediaRecorderRef = useRef<MediaRecorder | null>(null)
    const mediaStreamRef = useRef<MediaStream | null>(null)
    const audioChunksRef = useRef<Blob[]>([])

    const canSubmit = prompt.trim().length > 0 && mode !== 'thinking' && !isUploadingAudio
    const remaining = MAX_CHARS - prompt.length

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

                const blob = new Blob(chunks, { type: 'audio/webm;codecs=opus' })
                if (!blob.size) {
                    setIsRecording(false)
                    return
                }

                setStatusMessage('讯飞转写中，请稍候…')
                setIsUploadingAudio(true)
                setError(null)

                try {
                    const formData = new FormData()
                    formData.append('file', blob, 'browser-recording.opus')
                    formData.append('fileName', 'browser-recording.opus')

                    const response = await fetch('/api/transcribe/iflytek', {
                        method: 'POST',
                        body: formData
                    })

                    if (!response.ok) {
                        const message = await response.text()
                        throw new Error(message || '讯飞转写接口调用失败')
                    }

                    const data = await response.json()
                    const transcript = data?.transcript as string | undefined

                    if (!transcript) {
                        throw new Error('讯飞转写未返回文本结果')
                    }

                    setPrompt(prev => {
                        const merged = `${prev ? prev + '\n' : ''}${transcript}`
                        return merged.slice(0, MAX_CHARS)
                    })
                } catch (err) {
                    console.error(err)
                    setError('调用讯飞转写失败，请稍后再试或改用文字输入。')
                } finally {
                    setIsUploadingAudio(false)
                    setStatusMessage(null)
                    setIsRecording(false)
                }
            }

            mediaRecorderRef.current = recorder
            setIsRecording(true)
            setError(null)
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
        },
        [isUploadingAudio, speechProvider, stopActiveRecording]
    )

    const handleSubmit = useCallback(
        async (e: React.FormEvent) => {
            e.preventDefault()
            if (!canSubmit) return
            setMode('thinking')
            setError(null)

            try {
                await onSubmit?.({ prompt: prompt.trim(), source: 'text' })
            } catch (err) {
                console.error(err)
                setError('提交失败，请稍后再试。')
            } finally {
                setMode('idle')
            }
        },
        [canSubmit, onSubmit, prompt]
    )

    const handleVoiceSubmit = useCallback(async () => {
        if (!prompt.trim() || isUploadingAudio) return
        setMode('thinking')
        setError(null)
        try {
            await onSubmit?.({ prompt: prompt.trim(), source: 'voice' })
        } catch (err) {
            console.error(err)
            setError('提交失败，请稍后再试。')
        } finally {
            setMode('idle')
        }
    }, [isUploadingAudio, onSubmit, prompt])

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
            </header>

            <form onSubmit={handleSubmit} className="space-y-4">
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
                        placeholder="例如：我们两人想在 5 月份去日本自由行 8 天，预算 15000 元，喜欢美食和动漫，希望安排一天温泉。"
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
                        type="submit"
                        disabled={!canSubmit}
                        className="inline-flex items-center rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                    >
                        {mode === 'thinking' ? '正在生成…' : '开始规划'}
                    </button>

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
                        onClick={handleVoiceSubmit}
                        disabled={prompt.trim().length === 0 || mode === 'thinking' || isUploadingAudio}
                        className="inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-blue-400 hover:text-blue-600 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
                    >
                        使用当前描述开始规划
                    </button>
                </div>
            </form>

            {error ? <p className="mt-4 rounded bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
        </section>
    )
}
