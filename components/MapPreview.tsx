"use client"

import { useEffect, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

declare global {
    interface Window {
        _AMapSecurityConfig?: {
            securityJsCode?: string
        }
    }
}

const AMAP_VERSION = '2.0'
const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923]
const DEFAULT_ZOOM = 11

const ENV_API_KEY = (process.env.NEXT_PUBLIC_AMAP_API_KEY ?? '').trim()
const ENV_SECURITY_CODE = (process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? '').trim()

export type MapPreviewProps = {
    apiKey?: string
    securityJsCode?: string
    center?: [number, number]
    zoom?: number
}

export default function MapPreview({
    apiKey,
    securityJsCode,
    center = DEFAULT_CENTER,
    zoom = DEFAULT_ZOOM
}: MapPreviewProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const key = (apiKey ?? ENV_API_KEY ?? '').trim()
        const securityCode = (securityJsCode ?? ENV_SECURITY_CODE ?? '').trim()

        if (!containerRef.current || !key) {
            return
        }

        if (securityCode) {
            window._AMapSecurityConfig = {
                ...(window._AMapSecurityConfig ?? {}),
                securityJsCode: securityCode
            }
        }

        let map: any = null

        AMapLoader.load({
            key,
            version: AMAP_VERSION,
            plugins: ['AMap.Scale']
        })
            .then(AMap => {
                if (!containerRef.current) return
                map = new AMap.Map(containerRef.current, {
                    viewMode: '3D',
                    zoom,
                    center,
                    resizeEnable: true
                })

                if (AMap.Scale) {
                    map.addControl(new AMap.Scale())
                }
            })
            .catch(error => {
                console.error('[MapPreview] load error', error)
            })

        return () => {
            map?.destroy()
            map = null
        }
    }, [apiKey, center, securityJsCode, zoom])

    return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
