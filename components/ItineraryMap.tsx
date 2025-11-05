"use client"

import { useEffect, useMemo, useRef } from 'react'
import AMapLoader from '@amap/amap-jsapi-loader'

import type { DayPlan, TripPlanRecord } from '../types/trip'

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
const DAY_COLORS = ['#2563eb', '#f97316', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6']

const ENV_API_KEY = (process.env.NEXT_PUBLIC_AMAP_API_KEY ?? '').trim()
const ENV_SECURITY_CODE = (process.env.NEXT_PUBLIC_AMAP_SECURITY_CODE ?? '').trim()

type MapPoint = {
    position: [number, number]
    dayIndex: number
    order: number
    name: string
    type: 'attraction' | 'hotel'
    description?: string
    ticketPrice?: number
    currency?: string
}

type ItineraryMapProps = {
    plan: TripPlanRecord
    height?: number
}

function collectPoints(days: DayPlan[]): MapPoint[] {
    const points: MapPoint[] = []

    days.forEach((day, dayIdx) => {
        day.attractions.forEach((attraction, idx) => {
            if (typeof attraction.longitude === 'number' && typeof attraction.latitude === 'number') {
                points.push({
                    position: [attraction.longitude!, attraction.latitude!],
                    dayIndex: dayIdx + 1,
                    order: idx + 1,
                    name: attraction.name,
                    type: 'attraction',
                    description: attraction.description,
                    ticketPrice: attraction.ticket_price,
                    currency: attraction.currency
                })
            }
        })

        const hotel = day.hotel
        if (hotel && typeof hotel.longitude === 'number' && typeof hotel.latitude === 'number') {
            points.push({
                position: [hotel.longitude!, hotel.latitude!],
                dayIndex: dayIdx + 1,
                order: day.attractions.length + 1,
                name: hotel.name,
                type: 'hotel',
                description: hotel.address
            })
        }


    })

    return points
}

function collectPolylines(days: DayPlan[]) {
    return days
        .map((day, dayIdx) => {
            const path: [number, number][] = []

            day.attractions.forEach(attraction => {
                if (typeof attraction.longitude === 'number' && typeof attraction.latitude === 'number') {
                    path.push([attraction.longitude!, attraction.latitude!])
                }
            })

            return {
                dayIdx,
                path
            }
        })
        .filter(line => line.path.length >= 2)
}

export default function ItineraryMap({ plan, height = 420 }: ItineraryMapProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)

    const apiKey = (ENV_API_KEY || '').trim()
    const securityCode = (ENV_SECURITY_CODE || '').trim()

    const points = useMemo(() => collectPoints(plan.days), [plan.days])
    const polylines = useMemo(() => collectPolylines(plan.days), [plan.days])

    useEffect(() => {
        if (!containerRef.current || !apiKey) {
            return
        }

        if (securityCode) {
            window._AMapSecurityConfig = {
                ...(window._AMapSecurityConfig ?? {}),
                securityJsCode: securityCode
            }
        }

        let map: any = null
        const markers: any[] = []
        const lines: any[] = []
        let infoWindow: any = null

        AMapLoader.load({
            key: apiKey,
            version: AMAP_VERSION,
            plugins: ['AMap.Scale']
        })
            .then(AMap => {
                if (!containerRef.current) return

                map = new AMap.Map(containerRef.current, {
                    viewMode: '3D',
                    zoom: DEFAULT_ZOOM,
                    center: points.length > 0 ? points[0].position : DEFAULT_CENTER,
                    resizeEnable: true
                })

                infoWindow = new AMap.InfoWindow({ offset: new AMap.Pixel(0, -24) })

                points.forEach(point => {
                    const marker = new AMap.Marker({
                        position: point.position,
                        anchor: 'bottom-center',
                        label: {
                            content: `<div style="padding:4px 8px;border-radius:9999px;background:${DAY_COLORS[(point.dayIndex - 1) % DAY_COLORS.length]};color:#fff;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);">Day ${point.dayIndex}</div>`,
                            direction: 'top'
                        }
                    })

                    marker.on('click', () => {
                        const typeLabel = point.type === 'hotel' ? '住宿' : '景点'
                        const price =
                            point.ticketPrice !== undefined
                                ? `<div style="margin-top:4px;">费用：${point.ticketPrice}${point.currency ?? ''}</div>`
                                : ''

                        infoWindow.setContent(
                            `<div style="font-size:13px;line-height:1.5;max-width:240px;">
                                <strong>${point.name}</strong>
                                <div style="margin-top:4px;color:#475569;">类型：${typeLabel}</div>
                                ${point.description ? `<div style="margin-top:4px;color:#475569;">${point.description}</div>` : ''}
                                ${price}
                            </div>`
                        )
                        infoWindow.open(map, point.position)
                    })

                    markers.push(marker)
                })

                if (markers.length > 0) {
                    map.add(markers)
                    map.setFitView(markers, false, [60, 60, 60, 60])
                }

                polylines.forEach(line => {
                    const polyline = new AMap.Polyline({
                        path: line.path,
                        strokeColor: DAY_COLORS[line.dayIdx % DAY_COLORS.length],
                        strokeWeight: 4,
                        strokeOpacity: 0.9
                    })
                    lines.push(polyline)
                })

                if (lines.length > 0) {
                    map.add(lines)
                }

                if (AMap.Scale) {
                    map.addControl(new AMap.Scale())
                }
            })
            .catch(error => {
                console.error('[ItineraryMap] load error', error)
            })

        return () => {
            markers.forEach(marker => marker.setMap(null))
            lines.forEach(line => line.setMap(null))
            infoWindow?.close()
            map?.destroy()
        }
    }, [apiKey, points, polylines, securityCode])

    if (!apiKey) {
        return (
            <div className="flex h-full min-h-[280px] w-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                请在环境变量中配置 NEXT_PUBLIC_AMAP_API_KEY 后查看地图
            </div>
        )
    }

    return <div ref={containerRef} style={{ width: '100%', height }} className="overflow-hidden rounded-xl" />
}
