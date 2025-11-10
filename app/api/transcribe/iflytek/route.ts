import crypto from 'crypto'
import WebSocket from 'ws'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import type { RuntimeConfig } from '../../../../types/runtimeConfig'
import { loadUserRuntimeConfig } from '../../../../lib/runtimeConfig'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FALLBACK_WS_URL = 'wss://iat-api.xfyun.cn/v2/iat'
const FALLBACK_SAMPLE_RATE = 16000
const FALLBACK_CHUNK_BYTES = 1280
const FALLBACK_MAX_AUDIO_BYTES = 10 * 1024 * 1024
const FALLBACK_BUSINESS: Record<string, string> = {
    language: 'zh_cn',
    domain: 'iat',
    accent: 'mandarin',
    dwa: 'wpgs'
}

interface IflytekResolvedConfig {
    wsUrl: string
    appId: string
    apiKey: string
    apiSecret: string
    sampleRate: number
    chunkBytes: number
    maxBytes: number
    business: Record<string, string>
}

function parsePositiveInt(value: string | null | undefined, fallback: number) {
    const parsed = Number.parseInt((value ?? '').trim(), 10)
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
    }
    return fallback
}

function resolveIflytekConfig(runtimeConfig?: RuntimeConfig | null): IflytekResolvedConfig {
    const wsUrl = runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_URL?.trim() || process.env.NEXT_PUBLIC_IFLYTEK_IAT_URL?.trim() || FALLBACK_WS_URL
    const appId = runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_APP_ID?.trim() || process.env.NEXT_PUBLIC_IFLYTEK_IAT_APP_ID?.trim() || ''
    const apiKey = runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_API_KEY?.trim() || process.env.NEXT_PUBLIC_IFLYTEK_IAT_API_KEY?.trim() || ''
    const apiSecret = runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_API_SECRET?.trim() || process.env.NEXT_PUBLIC_IFLYTEK_IAT_API_SECRET?.trim() || ''

    const sampleRate = parsePositiveInt(runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_SAMPLE_RATE ?? process.env.NEXT_PUBLIC_IFLYTEK_IAT_SAMPLE_RATE, FALLBACK_SAMPLE_RATE)
    const chunkBytes = parsePositiveInt(runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_CHUNK_BYTES ?? process.env.NEXT_PUBLIC_IFLYTEK_IAT_CHUNK_BYTES, FALLBACK_CHUNK_BYTES)
    const maxBytes = parsePositiveInt(runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_MAX_BYTES ?? process.env.NEXT_PUBLIC_IFLYTEK_IAT_MAX_BYTES, FALLBACK_MAX_AUDIO_BYTES)

    const business: Record<string, string> = {
        language:
            runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_LANGUAGE?.trim() ||
            process.env.NEXT_PUBLIC_IFLYTEK_IAT_LANGUAGE?.trim() ||
            FALLBACK_BUSINESS.language,
        domain:
            runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_DOMAIN?.trim() ||
            process.env.NEXT_PUBLIC_IFLYTEK_IAT_DOMAIN?.trim() ||
            FALLBACK_BUSINESS.domain,
        accent:
            runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_ACCENT?.trim() ||
            process.env.NEXT_PUBLIC_IFLYTEK_IAT_ACCENT?.trim() ||
            FALLBACK_BUSINESS.accent,
        dwa:
            runtimeConfig?.NEXT_PUBLIC_IFLYTEK_IAT_DWA?.trim() ||
            process.env.NEXT_PUBLIC_IFLYTEK_IAT_DWA?.trim() ||
            FALLBACK_BUSINESS.dwa
    }

    return {
        wsUrl,
        appId,
        apiKey,
        apiSecret,
        sampleRate,
        chunkBytes,
        maxBytes,
        business
    }
}

const FRAME_STATUS = {
    FIRST: 0,
    CONTINUE: 1,
    LAST: 2
} as const

type FrameStatus = (typeof FRAME_STATUS)[keyof typeof FRAME_STATUS]

interface IatWord {
    w: string
}

interface IatSentence {
    cw: IatWord[]
}

interface IatResult {
    sn: number
    ws: IatSentence[]
    pgs?: 'rpl'
    rg?: [number, number]
}

interface IatResponsePayload {
    code: number
    message: string
    sid?: string
    data?: {
        status: number
        result?: IatResult
    }
}

function ensureCredentials(config: IflytekResolvedConfig) {
    if (!config.appId || !config.apiKey || !config.apiSecret) {
        throw new Error(
            '未配置讯飞语音听写凭证，请在设置页面填写 NEXT_PUBLIC_IFLYTEK_IAT_APP_ID、NEXT_PUBLIC_IFLYTEK_IAT_API_KEY、NEXT_PUBLIC_IFLYTEK_IAT_API_SECRET。'
        )
    }
}

function buildWsUrl(config: IflytekResolvedConfig, date: string) {
    const parsedUrl = new URL(config.wsUrl)
    const host = parsedUrl.host
    const path = parsedUrl.pathname || '/v2/iat'
    const signatureOrigin = `host: ${host}\ndate: ${date}\nGET ${path} HTTP/1.1`
    const signature = crypto.createHmac('sha256', config.apiSecret).update(signatureOrigin).digest('base64')
    const authorizationOrigin = `api_key="${config.apiKey}", algorithm="hmac-sha256", headers="host date request-line", signature="${signature}"`
    const authorization = Buffer.from(authorizationOrigin).toString('base64')

    const params = new URLSearchParams({
        authorization,
        date,
        host
    })

    return `${config.wsUrl}?${params.toString()}`
}

function buildTranscript(results: Array<IatResult | null>) {
    return results
        .filter((segment): segment is IatResult => Boolean(segment))
        .map(segment =>
            segment.ws
                .map(part => part.cw.map(word => word.w).join(''))
                .join('')
        )
        .join('')
}

function normaliseBusiness(base: Record<string, string>, overrides?: unknown) {
    if (!overrides || typeof overrides !== 'object') {
        return { ...base }
    }

    const sanitised: Record<string, string> = {}
    for (const [key, value] of Object.entries(overrides)) {
        if (typeof value === 'string' && value.trim().length > 0) {
            sanitised[key] = value.trim()
        }
    }

    return { ...base, ...sanitised }
}

function createFramePayload(params: {
    appId: string
    status: number
    chunk: Buffer | null
    sampleRate: number
    business: Record<string, string>
}) {
    const audioBase64 = params.chunk ? params.chunk.toString('base64') : ''
    const data = {
        status: params.status,
        format: `audio/L16;rate=${params.sampleRate}`,
        audio: audioBase64,
        encoding: 'raw'
    }

    if (params.status === FRAME_STATUS.FIRST) {
        return {
            common: {
                app_id: params.appId
            },
            business: params.business,
            data
        }
    }

    return { data }
}

async function streamByWebsocket(
    config: IflytekResolvedConfig,
    audio: Buffer,
    sampleRate: number,
    businessOverrides?: unknown
) {
    ensureCredentials(config)

    if (!audio.length) {
        throw new Error('音频内容为空，无法进行语音听写。')
    }

    if (audio.length > config.maxBytes) {
        throw new Error(`音频内容过大（>${Math.round(config.maxBytes / (1024 * 1024))}MB），请缩短录音时长后再试。`)
    }

    const business = normaliseBusiness(config.business, businessOverrides)
    const chunkSize = Number.isFinite(config.chunkBytes) && config.chunkBytes > 0 ? config.chunkBytes : FALLBACK_CHUNK_BYTES

    return new Promise<{
        transcript: string
        segments: IatResult[]
        sid?: string
        message?: string
    }>((resolve, reject) => {
        const date = new Date().toUTCString()
        const wsUrl = buildWsUrl(config, date)
        const ws = new WebSocket(wsUrl)

        let hasFinished = false
        const results: Array<IatResult | null> = []
        let sid: string | undefined

        ws.on('open', () => {
            let status: FrameStatus = FRAME_STATUS.FIRST
            let offset = 0

            const sendNextFrame = () => {
                if (hasFinished || ws.readyState !== WebSocket.OPEN) {
                    return
                }

                if (offset >= audio.length) {
                    const lastFrame = createFramePayload({
                        appId: config.appId,
                        status: FRAME_STATUS.LAST,
                        chunk: null,
                        sampleRate,
                        business
                    })
                    ws.send(JSON.stringify(lastFrame))
                    status = FRAME_STATUS.LAST
                    return
                }

                const end = Math.min(offset + chunkSize, audio.length)
                const chunk = audio.subarray(offset, end)
                const frame = createFramePayload({
                    appId: config.appId,
                    status,
                    chunk,
                    sampleRate,
                    business
                })
                ws.send(JSON.stringify(frame))
                status = FRAME_STATUS.CONTINUE
                offset = end

                setTimeout(sendNextFrame, 40)
            }

            sendNextFrame()
        })

        ws.on('message', raw => {
            try {
                const payload = JSON.parse(raw.toString()) as IatResponsePayload
                sid = payload.sid ?? sid

                if (payload.code !== 0) {
                    if (!hasFinished) {
                        hasFinished = true
                        ws.close()
                        reject(new Error(`讯飞语音听写失败（${payload.code}）：${payload.message}`))
                    }
                    return
                }

                const data = payload.data
                if (data?.result) {
                    const result = data.result
                    if (result.pgs === 'rpl' && Array.isArray(result.rg)) {
                        const [start, end] = result.rg
                        for (let i = start; i <= end; i += 1) {
                            results[i] = null
                        }
                    }
                    results[result.sn] = result
                }

                if (data?.status === FRAME_STATUS.LAST) {
                    const transcript = buildTranscript(results)
                    const segments = results.filter((segment): segment is IatResult => Boolean(segment))
                    hasFinished = true
                    ws.close()
                    resolve({ transcript, segments, sid, message: payload.message })
                }
            } catch (error) {
                if (!hasFinished) {
                    hasFinished = true
                    ws.close()
                    reject(error instanceof Error ? error : new Error('解析讯飞返回数据失败'))
                }
            }
        })

        ws.on('error', err => {
            if (!hasFinished) {
                hasFinished = true
                ws.close()
                reject(err instanceof Error ? err : new Error('讯飞语音听写连接出现错误'))
            }
        })

        ws.on('close', () => {
            if (!hasFinished) {
                hasFinished = true
                reject(new Error('讯飞语音听写连接已关闭但未返回最终结果。'))
            }
        })
    })
}

interface RequestBody {
    audio?: string
    pcm?: string
    sampleRate?: number | string
    business?: unknown
}

export async function POST(request: Request) {
    try {
        const supabase = createRouteHandlerClient({ cookies })
        const {
            data: { user }
        } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: '未授权，请登录后再使用语音听写功能。' }, { status: 401 })
        }

        const runtimeConfig = await loadUserRuntimeConfig(supabase, user.id)
        const iflytekConfig = resolveIflytekConfig(runtimeConfig)

        const parsedBody = (await request.json().catch(() => null)) as RequestBody | null

        if (!parsedBody || typeof parsedBody !== 'object') {
            return NextResponse.json({ error: '请求体格式错误，请使用 JSON。' }, { status: 400 })
        }

        const audioBase64 = typeof parsedBody.audio === 'string'
            ? parsedBody.audio
            : typeof parsedBody.pcm === 'string'
                ? parsedBody.pcm
                : ''

        if (!audioBase64) {
            return NextResponse.json({ error: '缺少音频内容，请提供 base64 编码的 PCM 数据。' }, { status: 400 })
        }

        let audioBuffer: Buffer
        try {
            audioBuffer = Buffer.from(audioBase64, 'base64')
        } catch {
            return NextResponse.json({ error: '音频内容解析失败，请确保是有效的 base64 字符串。' }, { status: 400 })
        }

        if (!audioBuffer.length) {
            return NextResponse.json({ error: '音频内容为空，请检查录音流程。' }, { status: 400 })
        }

        const requestedSampleRate = Number(parsedBody.sampleRate)
        const sampleRate = Number.isFinite(requestedSampleRate) && requestedSampleRate > 0
            ? requestedSampleRate
            : iflytekConfig.sampleRate

        const { transcript, segments, sid, message } = await streamByWebsocket(
            iflytekConfig,
            audioBuffer,
            sampleRate,
            parsedBody.business
        )

        return NextResponse.json({ transcript, segments, sid, message })
    } catch (error) {
        console.error('[iflytek-transcribe-websocket]', error)
        const message = error instanceof Error ? error.message : '讯飞语音听写出现未知错误'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
