"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

import {
    EDITABLE_RUNTIME_KEYS,
    type RuntimeConfig,
    type RuntimeConfigKey
} from '../../types/runtimeConfig'

type ConfigField = {
    key: RuntimeConfigKey
    label: string
    description?: string
    helper?: string
    placeholder?: string
    sensitive?: boolean
}

type ConfigGroup = {
    id: string
    title: string
    description?: string
    fields: ConfigField[]
}

const CONFIG_GROUPS: ConfigGroup[] = [
    {
        id: 'amap',
        title: '高德地图与地理服务',
        description: '用于加载地图、坐标转换及地点预览。',
        fields: [
            {
                key: 'NEXT_PUBLIC_AMAP_API_KEY',
                label: 'AMap Web API Key',
                helper: '登录高德开放平台 → 我的应用 → Key 管理，填写 Web 服务 Key。',
                placeholder: '例如：38c4f3dxxxxxxxxxxxxxxxx'
            },
            {
                key: 'NEXT_PUBLIC_AMAP_SECURITY_CODE',
                label: 'AMap 安全密钥',
                helper: '若启用了「安全密钥」校验，请填入 JSAPI 安全密钥。未启用可留空。',
                placeholder: '例如：a1b2c3d4e5f6g7h8'
            }
        ]
    },
    {
        id: 'iflytek',
        title: '科大讯飞语音听写',
        description: '覆盖 IAT WebSocket 接口的鉴权参数与业务配置。',
        fields: [
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_APP_ID',
                label: 'APP ID',
                helper: '控制台创建应用后获取的 APPID。'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_API_KEY',
                label: 'API Key',
                helper: '用于签名的 API Key。'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_API_SECRET',
                label: 'API Secret',
                helper: '用于签名的 API Secret。'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_URL',
                label: 'WebSocket 地址',
                helper: '默认使用官方地址，可按需替换为内测/私有化地址。',
                placeholder: '例如：wss://iat-api.xfyun.cn/v2/iat'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_SAMPLE_RATE',
                label: '采样率 (Hz)',
                helper: 'PCM 音频采样率，默认 16000。',
                placeholder: '16000'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_CHUNK_BYTES',
                label: '分片字节数',
                helper: '每次推送的字节数，默认 1280 (约 40ms)。',
                placeholder: '1280'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_MAX_BYTES',
                label: '最大音频大小 (字节)',
                helper: '音频流大小限制，默认 10485760 (10MB)。',
                placeholder: '10485760'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_LANGUAGE',
                label: '语言',
                helper: '默认 zh_cn，可根据识别语种调整。',
                placeholder: 'zh_cn'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_DOMAIN',
                label: '领域 (domain)',
                helper: '默认 iat，如需使用商务/教育等场景请填写官方提供的 domain。',
                placeholder: 'iat'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_ACCENT',
                label: '口音 (accent)',
                helper: '默认 mandarin，可选 cantonese、henanese 等。',
                placeholder: 'mandarin'
            },
            {
                key: 'NEXT_PUBLIC_IFLYTEK_IAT_DWA',
                label: '动态修正 (dwa)',
                helper: '设为 wpgs 开启动态修正，默认 wpgs。',
                placeholder: 'wpgs'
            }
        ]
    },
    {
        id: 'bailian',
        title: '阿里云百炼大模型',
        description: '用于行程解析与生成的模型配置。',
        fields: [
            {
                key: 'NEXT_PUBLIC_BAILIAN_API_KEY',
                label: '百炼 API Key',
                helper: '百炼控制台创建的 API Key。'
            },
            {
                key: 'NEXT_PUBLIC_BAILIAN_API_BASE_URL',
                label: 'API Base URL',
                helper: '自定义域名或代理网关，如无需自定义可留空。',
                placeholder: '例如：https://dashscope.aliyuncs.com/compatible-mode/v1'
            },
            {
                key: 'NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL',
                label: '默认模型',
                helper: '用于通用调用的默认模型名称。',
                placeholder: 'qwen-max'
            },
            {
                key: 'NEXT_PUBLIC_BAILIAN_TRIP_REQUEST_MODEL',
                label: '需求解析模型',
                helper: 'TripRequest 抽取时使用的模型。',
                placeholder: 'qwen-turbo'
            },
            {
                key: 'NEXT_PUBLIC_BAILIAN_TRIP_PLAN_MODEL',
                label: '行程生成模型',
                helper: 'TripPlan 生成时使用的模型。',
                placeholder: 'qwen-max'
            },
            {
                key: 'NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS',
                label: '请求超时时间 (ms)',
                helper: '后端调用百炼接口的超时时间，默认 60000。',
                placeholder: '60000'
            }
        ]
    }
]

const NUMERIC_KEYS = new Set<RuntimeConfigKey>([
    'NEXT_PUBLIC_IFLYTEK_IAT_SAMPLE_RATE',
    'NEXT_PUBLIC_IFLYTEK_IAT_CHUNK_BYTES',
    'NEXT_PUBLIC_IFLYTEK_IAT_MAX_BYTES',
    'NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS'
])

const SENSITIVE_KEY_PATTERN = /(KEY|SECRET|TOKEN)/i

function normalizeOverrides(config?: RuntimeConfig | null): RuntimeConfig {
    const result: RuntimeConfig = {}
    if (!config) return result

    for (const key of EDITABLE_RUNTIME_KEYS) {
        const value = config[key]
        if (typeof value === 'string' && value.length > 0) {
            result[key] = value
        }
    }
    return result
}

function normalizeEffective(config?: RuntimeConfig | null): RuntimeConfig {
    const result: RuntimeConfig = {}
    for (const key of EDITABLE_RUNTIME_KEYS) {
        const value = config?.[key]
        result[key] = typeof value === 'string' ? value : ''
    }
    return result
}

function shallowEqualConfig(a: RuntimeConfig, b: RuntimeConfig): boolean {
    for (const key of EDITABLE_RUNTIME_KEYS) {
        if ((a[key] ?? '') !== (b[key] ?? '')) {
            return false
        }
    }
    return true
}

function maskSecret(value: string) {
    if (!value) return '未配置'
    if (value.length <= 4) {
        return '••••'
    }
    const visible = value.slice(-4)
    const maskedLength = Math.min(value.length - 4, 8)
    return `${'•'.repeat(maskedLength)}${visible}`
}

function getDisplayEffective(value: string, shouldMask: boolean) {
    if (!value) return '未配置'
    return shouldMask ? maskSecret(value) : value
}

export default function RuntimeConfigSettings() {
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState<string | null>(null)
    const [originalOverrides, setOriginalOverrides] = useState<RuntimeConfig>({})
    const [draftOverrides, setDraftOverrides] = useState<RuntimeConfig>({})
    const [effectiveConfig, setEffectiveConfig] = useState<RuntimeConfig>({})
    const [revealedKeys, setRevealedKeys] = useState<Partial<Record<RuntimeConfigKey, boolean>>>({})

    const hasChanges = useMemo(() => !shallowEqualConfig(originalOverrides, draftOverrides), [originalOverrides, draftOverrides])

    const loadConfig = useCallback(async () => {
        setLoading(true)
        setError(null)
        setSuccess(null)
        try {
            const response = await fetch('/api/settings/config', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                cache: 'no-store'
            })
            const payload = await response.json().catch(() => ({}))
            if (!response.ok) {
                throw new Error(payload?.error || '加载运行时配置失败。')
            }
            const overrides = normalizeOverrides(payload?.data?.overrides as RuntimeConfig)
            const effective = normalizeEffective(payload?.data?.effective as RuntimeConfig)
            setOriginalOverrides(overrides)
            setDraftOverrides({ ...overrides })
            setEffectiveConfig(effective)
            setRevealedKeys({})
        } catch (err) {
            console.error('load runtime config failed', err)
            setError(err instanceof Error ? err.message : '加载运行时配置失败，请稍后再试。')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        void loadConfig()
    }, [loadConfig])

    useEffect(() => {
        if (!success) return
        const timer = setTimeout(() => setSuccess(null), 6000)
        return () => clearTimeout(timer)
    }, [success])

    const handleFieldChange = useCallback((key: RuntimeConfigKey, value: string) => {
        const normalized = value ?? ''
        const trimmed = normalized.trim()
        setDraftOverrides(prev => {
            const next = { ...prev }
            if (trimmed) {
                next[key] = trimmed
            } else {
                delete next[key]
            }
            return next
        })
        setError(null)
        setSuccess(null)
    }, [])

    const handleClearField = useCallback((key: RuntimeConfigKey) => {
        setDraftOverrides(prev => {
            if (!(key in prev)) return prev
            const next = { ...prev }
            delete next[key]
            return next
        })
        setError(null)
        setSuccess(null)
    }, [])

    const toggleReveal = useCallback((key: RuntimeConfigKey) => {
        setRevealedKeys(prev => ({ ...prev, [key]: !prev[key] }))
    }, [])

    const handleReset = useCallback(() => {
        setDraftOverrides({ ...originalOverrides })
        setError(null)
        setSuccess(null)
        setRevealedKeys({})
    }, [originalOverrides])

    const handleSubmit = useCallback(
        async (event: FormEvent<HTMLFormElement>) => {
            event.preventDefault()
            if (!hasChanges || saving) return
            setSaving(true)
            setError(null)
            setSuccess(null)
            try {
                const response = await fetch('/api/settings/config', {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({ config: draftOverrides })
                })
                const payload = await response.json().catch(() => ({}))
                if (!response.ok) {
                    throw new Error(payload?.error || '保存运行时配置失败。')
                }
                const overrides = normalizeOverrides(payload?.data?.overrides as RuntimeConfig)
                const effective = normalizeEffective(payload?.data?.effective as RuntimeConfig)
                setOriginalOverrides(overrides)
                setDraftOverrides({ ...overrides })
                setEffectiveConfig(effective)
                setSuccess('配置已保存并立即生效。')
                setRevealedKeys({})
            } catch (err) {
                console.error('save runtime config failed', err)
                setError(err instanceof Error ? err.message : '保存运行时配置失败，请稍后再试。')
            } finally {
                setSaving(false)
            }
        },
        [draftOverrides, hasChanges, saving]
    )

    return (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <header className="space-y-1">
                <h2 className="text-xl font-semibold text-slate-900">运行时配置</h2>
                <p className="text-sm text-slate-500">
                    这里的值会覆盖 .env 配置，保存后立即生效。仅当前账号可见，可通过清空字段恢复默认值。
                </p>
            </header>

            {error ? (
                <div className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                    {error}
                </div>
            ) : null}
            {success ? (
                <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {success}
                </div>
            ) : null}

            {loading ? (
                <div className="mt-6 space-y-4">
                    <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
                    <div className="h-28 animate-pulse rounded-xl bg-slate-100" />
                </div>
            ) : (
                <form onSubmit={handleSubmit} className="mt-6 space-y-8">
                    {CONFIG_GROUPS.map(group => (
                        <section key={group.id} className="space-y-4">
                            <div className="space-y-1">
                                <h3 className="text-lg font-medium text-slate-800">{group.title}</h3>
                                {group.description ? (
                                    <p className="text-sm text-slate-500">{group.description}</p>
                                ) : null}
                            </div>
                            <div className="grid gap-4 lg:grid-cols-2">
                                {group.fields.map(field => {
                                    const key = field.key
                                    const draftValue = draftOverrides[key] ?? ''
                                    const originalValue = originalOverrides[key] ?? ''
                                    const effectiveValue = effectiveConfig[key] ?? ''
                                    const hasSavedOverride = originalValue.length > 0
                                    const hasDraftOverride = draftValue.length > 0
                                    const isDirty = draftValue !== originalValue
                                    const isSensitive = field.sensitive ?? SENSITIVE_KEY_PATTERN.test(key)
                                    const revealed = Boolean(revealedKeys[key])
                                    const maskEffective = isSensitive && !revealed
                                    const displayEffective = getDisplayEffective(effectiveValue, maskEffective)
                                    const inputType = isSensitive && !revealed ? 'password' : 'text'
                                    const inputMode = NUMERIC_KEYS.has(key) ? 'numeric' : undefined

                                    return (
                                        <div
                                            key={key}
                                            className={`rounded-xl border p-4 shadow-sm transition-colors ${isDirty
                                                ? 'border-amber-300 bg-amber-50'
                                                : hasSavedOverride
                                                    ? 'border-blue-200 bg-blue-50'
                                                    : 'border-slate-200 bg-slate-50'
                                                }`}
                                        >
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="space-y-1">
                                                    <label htmlFor={key} className="text-sm font-semibold text-slate-800">
                                                        {field.label}
                                                    </label>
                                                    {field.description ? (
                                                        <p className="text-xs text-slate-500">{field.description}</p>
                                                    ) : null}
                                                </div>
                                                <div className="flex flex-col items-end gap-2">
                                                    {isDirty ? (
                                                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                                            待保存
                                                        </span>
                                                    ) : hasSavedOverride ? (
                                                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                                            已覆盖
                                                        </span>
                                                    ) : null}
                                                    {hasDraftOverride ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleClearField(key)}
                                                            className="text-xs font-medium text-slate-500 transition hover:text-slate-700"
                                                        >
                                                            恢复默认
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>

                                            <div className="relative mt-3">
                                                <input
                                                    id={key}
                                                    name={key}
                                                    type={inputType}
                                                    value={draftValue}
                                                    onChange={event => handleFieldChange(key, event.target.value)}
                                                    placeholder={field.placeholder}
                                                    autoComplete="off"
                                                    inputMode={inputMode}
                                                    className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-800 shadow-inner focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 ${isSensitive ? 'pr-20' : ''}`}
                                                />
                                                {isSensitive ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleReveal(key)}
                                                        className="absolute inset-y-0 right-2 flex items-center text-xs font-medium text-slate-500 transition hover:text-slate-700"
                                                    >
                                                        {revealed ? '隐藏' : '显示'}
                                                    </button>
                                                ) : null}
                                            </div>

                                            <div className="mt-2 space-y-1 text-xs text-slate-500">
                                                <p>
                                                    当前生效值：
                                                    <span className="font-mono text-[11px] text-slate-600">{displayEffective}</span>
                                                </p>
                                                {field.helper ? <p>{field.helper}</p> : null}
                                                {!hasDraftOverride && !hasSavedOverride ? (
                                                    <p className="text-[11px] text-slate-400">
                                                        留空表示沿用默认环境变量。
                                                    </p>
                                                ) : null}
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </section>
                    ))}

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="submit"
                            disabled={!hasChanges || saving}
                            className="rounded-full bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-300"
                        >
                            {saving ? '保存中…' : '保存配置'}
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            disabled={!hasChanges || saving}
                            className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:text-slate-400"
                        >
                            放弃修改
                        </button>
                        <button
                            type="button"
                            onClick={() => void loadConfig()}
                            disabled={saving}
                            className="rounded-full border border-transparent px-4 py-2 text-sm font-medium text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                        >
                            重新加载
                        </button>
                    </div>
                </form>
            )}
        </section>
    )
}
