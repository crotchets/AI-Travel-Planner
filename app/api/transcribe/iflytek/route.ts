import crypto from 'crypto'
import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

interface IflytekResponse<T = unknown> {
    ok: number
    err_no: number
    failed: string | null
    data: T
}

interface ProgressPayload {
    desc: string
    status: number
}

interface ResultSegment {
    onebest?: string
    speaker?: string
    bg?: string
    ed?: string
    wordsResultList?: Array<{
        wordsName: string
        wordBg: string
        wordEd: string
        wc: string
    }>
}

const HOST = process.env.IFLYTEK_API_HOST?.replace(/\/$/, '') ?? 'https://raasr.xfyun.cn'
const APP_ID = process.env.IFLYTEK_APP_ID
const SECRET_KEY = process.env.IFLYTEK_API_SECRET ?? process.env.IFLYTEK_SECRET_KEY

const MAX_FILE_BYTES = Number(process.env.IFLYTEK_MAX_FILE_BYTES ?? 15 * 1024 * 1024)
const FILE_PIECE_SIZE = Number(process.env.IFLYTEK_FILE_PIECE_SIZE ?? 10 * 1024 * 1024)
const POLL_INTERVAL_MS = Number(process.env.IFLYTEK_POLL_INTERVAL_MS ?? 5_000)
const POLL_TIMEOUT_MS = Number(process.env.IFLYTEK_POLL_TIMEOUT_MS ?? 2 * 60_000)

const DEFAULT_PREPARE_OPTIONS: Record<string, string | undefined> = {
    lfasr_type: process.env.IFLYTEK_LFASR_TYPE ?? '0',
    has_participle: process.env.IFLYTEK_HAS_PARTICIPLE,
    has_seperate: process.env.IFLYTEK_HAS_SEPERATE,
    max_alternatives: process.env.IFLYTEK_MAX_ALTERNATIVES,
    has_smooth: process.env.IFLYTEK_HAS_SMOOTH,
    eng_vad_margin: process.env.IFLYTEK_ENG_VAD_MARGIN,
    track_mode: process.env.IFLYTEK_TRACK_MODE,
    speaker_number: process.env.IFLYTEK_SPEAKER_NUMBER,
    role_type: process.env.IFLYTEK_ROLE_TYPE,
    language: process.env.IFLYTEK_LANGUAGE,
    pd: process.env.IFLYTEK_PD,
    hotWord: process.env.IFLYTEK_HOT_WORD
}

const PREPARE_OPTION_KEYS = new Set(Object.keys(DEFAULT_PREPARE_OPTIONS))

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

class SliceIdGenerator {
    #current: string

    constructor() {
        this.#current = 'aaaaaaaaa`'
    }

    next() {
        let ch = this.#current
        let i = ch.length - 1

        while (i >= 0) {
            const code = ch.charCodeAt(i)
            if (code !== 122) {
                ch = ch.slice(0, i) + String.fromCharCode(code + 1) + ch.slice(i + 1)
                break
            }

            ch = ch.slice(0, i) + 'a' + ch.slice(i + 1)
            i -= 1
        }

        this.#current = ch
        return ch
    }
}

function ensureCredentials() {
    if (!APP_ID || !SECRET_KEY) {
        throw new Error('未配置讯飞语音转写凭证，请在环境变量中设置 IFLYTEK_APP_ID 和 IFLYTEK_API_SECRET。')
    }
}

function createAuth() {
    ensureCredentials()
    const ts = Math.floor(Date.now() / 1000).toString()
    const md5 = crypto.createHash('md5').update(`${APP_ID}${ts}`).digest('hex')
    const signa = crypto.createHmac('sha1', SECRET_KEY as string).update(md5).digest('base64')
    return { ts, signa }
}

async function postUrlEncoded(path: string, params: Record<string, string>) {
    const { ts, signa } = createAuth()
    const body = new URLSearchParams({ app_id: APP_ID as string, ts, signa, ...params })

    const response = await fetch(`${HOST}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
        body,
        cache: 'no-store'
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`调用讯飞接口失败（${path}）: ${text || response.status}`)
    }

    const data = (await response.json()) as IflytekResponse
    return data
}

async function postMultipart(path: string, formData: FormData) {
    const response = await fetch(`${HOST}${path}`, {
        method: 'POST',
        body: formData,
        cache: 'no-store'
    })

    if (!response.ok) {
        const text = await response.text()
        throw new Error(`调用讯飞接口失败（${path}）: ${text || response.status}`)
    }

    const data = (await response.json()) as IflytekResponse
    return data
}

function assertOk<T>(payload: IflytekResponse<T>, step: string) {
    if (payload.ok !== 0) {
        throw new Error(`讯飞接口调用失败（${step}）：${payload.failed ?? '未知错误'}，错误码：${payload.err_no}`)
    }
}

function parseJsonPayload<T>(value: unknown, step: string): T {
    if (typeof value === 'string') {
        try {
            return JSON.parse(value) as T
        } catch (error) {
            const message = error instanceof Error ? error.message : '未知错误'
            throw new Error(`解析讯飞返回数据失败（${step}）：${message}`)
        }
    }

    return value as T
}

export async function POST(request: Request) {
    try {
        ensureCredentials()

        const formData = await request.formData()
        const file = formData.get('file')
        const fileName = (formData.get('fileName') as string) || 'browser-recording.opus'

        if (!(file instanceof Blob)) {
            return NextResponse.json({ error: '缺少音频文件内容' }, { status: 400 })
        }

        const arrayBuffer = await file.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        if (!buffer.length) {
            return NextResponse.json({ error: '空音频文件，请重新录制后再试。' }, { status: 400 })
        }

        if (buffer.length > MAX_FILE_BYTES) {
            return NextResponse.json(
                { error: `音频文件过大（>${Math.round(MAX_FILE_BYTES / (1024 * 1024))}MB），请缩短录音时长。` },
                { status: 400 }
            )
        }

        const pieceSize = Number.isFinite(FILE_PIECE_SIZE) && FILE_PIECE_SIZE > 0 ? FILE_PIECE_SIZE : 10 * 1024 * 1024
        const sliceNum = Math.max(1, Math.ceil(buffer.length / pieceSize))

        const prepareParams: Record<string, string> = {
            file_len: buffer.length.toString(),
            file_name: fileName,
            slice_num: sliceNum.toString()
        }

        for (const key of PREPARE_OPTION_KEYS) {
            const formValue = formData.get(key)
            if (typeof formValue === 'string' && formValue.trim().length > 0) {
                prepareParams[key] = formValue.trim()
            } else {
                const defaultValue = DEFAULT_PREPARE_OPTIONS[key]
                if (typeof defaultValue === 'string' && defaultValue.length > 0) {
                    prepareParams[key] = defaultValue
                }
            }
        }

        const prepareResponse = await postUrlEncoded('/api/prepare', prepareParams)
        assertOk(prepareResponse, 'prepare')
        const taskId = prepareResponse.data as string

        const sliceIdGenerator = new SliceIdGenerator()
        let offset = 0
        let partIndex = 0

        while (offset < buffer.length) {
            const end = Math.min(offset + pieceSize, buffer.length)
            const chunk = buffer.subarray(offset, end)
            const { ts, signa } = createAuth()
            const uploadForm = new FormData()
            uploadForm.append('app_id', APP_ID as string)
            uploadForm.append('ts', ts)
            uploadForm.append('signa', signa)
            uploadForm.append('task_id', taskId)
            uploadForm.append('slice_id', sliceIdGenerator.next())
            uploadForm.append('content', new Blob([chunk]), `${fileName}.part${String(partIndex).padStart(4, '0')}`)

            const uploadResponse = await postMultipart('/api/upload', uploadForm)
            assertOk(uploadResponse, `upload-${partIndex + 1}`)

            offset = end
            partIndex += 1
        }

        const mergeParams: Record<string, string> = { task_id: taskId, file_name: fileName }
        const mergeResponse = await postUrlEncoded('/api/merge', mergeParams)
        assertOk(mergeResponse, 'merge')

        const startedAt = Date.now()
        let status = 0
        let progressDesc: string | undefined

        while (Date.now() - startedAt < POLL_TIMEOUT_MS) {
            const progressResponse = await postUrlEncoded('/api/getProgress', { task_id: taskId })
            assertOk(progressResponse, 'getProgress')

            const payload = parseJsonPayload<ProgressPayload>(progressResponse.data, 'getProgress')
            status = Number(payload.status)
            progressDesc = payload.desc

            if (status === 9) {
                break
            }

            await sleep(POLL_INTERVAL_MS)
        }

        if (status !== 9) {
            throw new Error(progressDesc ? `讯飞转写超时（${progressDesc}），请稍后重试。` : '讯飞转写超时未完成，请稍后重试。')
        }

        const resultResponse = await postUrlEncoded('/api/getResult', { task_id: taskId })
        assertOk(resultResponse, 'getResult')

        const segments = parseJsonPayload<ResultSegment[]>(resultResponse.data, 'getResult')
        const transcriptParts = segments
            .map(segment => segment.onebest?.trim())
            .filter((text): text is string => Boolean(text && text.length > 0))
        const transcript = transcriptParts.join('\n')

        if (!transcript) {
            throw new Error('讯飞转写完成但返回结果为空，请检查音频内容。')
        }

        return NextResponse.json({ transcript, segments, taskId, progress: { desc: progressDesc, status } })
    } catch (error) {
        console.error('[iflytek-transcribe]', error)
        const message = error instanceof Error ? error.message : '讯飞转写出现未知错误'
        return NextResponse.json({ error: message }, { status: 500 })
    }
}
