import type { SupabaseClient } from '@supabase/supabase-js'

import { EDITABLE_RUNTIME_KEYS, type RuntimeConfig } from '../types/runtimeConfig'

export const RUNTIME_CONFIG_TABLE = 'user_runtime_config'

export type RuntimeConfigPayload = {
    overrides: RuntimeConfig
    effective: RuntimeConfig
}

const ENV_DEFAULTS: RuntimeConfig = {
    NEXT_PUBLIC_AMAP_API_KEY: process.env.NEXT_PUBLIC_AMAP_API_KEY ?? '',
    NEXT_PUBLIC_AMAP_SECURITY_CODE: process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_APP_ID: process.env.NEXT_PUBLIC_IFLYTEK_IAT_APP_ID ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_API_KEY: process.env.NEXT_PUBLIC_IFLYTEK_IAT_API_KEY ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_API_SECRET: process.env.NEXT_PUBLIC_IFLYTEK_IAT_API_SECRET ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_URL: process.env.NEXT_PUBLIC_IFLYTEK_IAT_URL ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_SAMPLE_RATE: process.env.NEXT_PUBLIC_IFLYTEK_IAT_SAMPLE_RATE ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_CHUNK_BYTES: process.env.NEXT_PUBLIC_IFLYTEK_IAT_CHUNK_BYTES ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_MAX_BYTES: process.env.NEXT_PUBLIC_IFLYTEK_IAT_MAX_BYTES ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_LANGUAGE: process.env.NEXT_PUBLIC_IFLYTEK_IAT_LANGUAGE ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_DOMAIN: process.env.NEXT_PUBLIC_IFLYTEK_IAT_DOMAIN ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_ACCENT: process.env.NEXT_PUBLIC_IFLYTEK_IAT_ACCENT ?? '',
    NEXT_PUBLIC_IFLYTEK_IAT_DWA: process.env.NEXT_PUBLIC_IFLYTEK_IAT_DWA ?? '',
    NEXT_PUBLIC_BAILIAN_API_KEY: process.env.NEXT_PUBLIC_BAILIAN_API_KEY ?? '',
    NEXT_PUBLIC_BAILIAN_API_BASE_URL: process.env.NEXT_PUBLIC_BAILIAN_API_BASE_URL ?? '',
    NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL: process.env.NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL ?? '',
    NEXT_PUBLIC_BAILIAN_TRIP_REQUEST_MODEL: process.env.NEXT_PUBLIC_BAILIAN_TRIP_REQUEST_MODEL ?? '',
    NEXT_PUBLIC_BAILIAN_TRIP_PLAN_MODEL: process.env.NEXT_PUBLIC_BAILIAN_TRIP_PLAN_MODEL ?? '',
    NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS: process.env.NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS ?? ''
}

export function getEnvDefaults(): RuntimeConfig {
    return { ...ENV_DEFAULTS }
}

export function mergeRuntimeConfig(defaults: RuntimeConfig, overrides?: RuntimeConfig | null): RuntimeConfig {
    if (!overrides) {
        return { ...defaults }
    }
    const merged: RuntimeConfig = { ...defaults }
    for (const key of EDITABLE_RUNTIME_KEYS) {
        if (typeof overrides[key] === 'string' && overrides[key]) {
            merged[key] = overrides[key] as string
        }
    }
    return merged
}

export function sanitizeConfigInput(input: Record<string, unknown>): RuntimeConfig {
    const sanitized: RuntimeConfig = {}
    for (const key of EDITABLE_RUNTIME_KEYS) {
        const value = input[key]
        if (typeof value === 'string') {
            sanitized[key] = value.trim()
        }
    }
    return sanitized
}

export async function loadUserRuntimeConfig(
    supabase: SupabaseClient,
    userId: string
): Promise<RuntimeConfig | null> {
    const { data, error } = await supabase
        .from(RUNTIME_CONFIG_TABLE)
        .select('config')
        .eq('user_id', userId)
        .maybeSingle()

    if (error) {
        console.error('loadUserRuntimeConfig failed', error)
        throw new Error('加载配置失败，请稍后再试。')
    }

    return (data?.config ?? null) as RuntimeConfig | null
}

export async function upsertUserRuntimeConfig(
    supabase: SupabaseClient,
    userId: string,
    overrides: RuntimeConfig
): Promise<void> {
    const payload = { user_id: userId, config: overrides }
    const { error } = await supabase
        .from(RUNTIME_CONFIG_TABLE)
        .upsert(payload, { onConflict: 'user_id' })

    if (error) {
        console.error('upsertUserRuntimeConfig failed', error)
        throw new Error('保存配置失败，请稍后再试。')
    }
}
