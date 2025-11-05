import type { Attraction, DayPlan, Meal, TripPlan, TripRequest, WeatherInfo } from '../types/trip'

function isString(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0
}

function isNumber(value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value)
}

function isArray<T>(value: unknown, predicate: (item: unknown) => item is T): value is T[] {
    return Array.isArray(value) && value.every(item => predicate(item))
}

function isWeatherInfo(value: any): value is WeatherInfo {
    return (
        value &&
        isString(value.date) &&
        isNumber(value.temperature) &&
        isString(value.condition)
    )
}

function isMeal(value: any): value is Meal {
    return value && isString(value.name) && isString(value.type)
}

function isAttraction(value: any): value is Attraction {
    return value && isString(value.name)
}

function isDayPlan(value: any): value is DayPlan {
    return (
        value &&
        isString(value.date) &&
        typeof value.day_index === 'number' &&
        Number.isInteger(value.day_index) &&
        value.day_index >= 1 &&
        isArray(value.attractions, isAttraction) &&
        isArray(value.meals, isMeal)
    )
}

export function validateTripPlan(raw: unknown): asserts raw is TripPlan {
    if (typeof raw !== 'object' || raw === null) {
        throw new Error('TripPlan 必须是对象。')
    }
    const plan = raw as TripPlan
    if (!isString(plan.city)) throw new Error('TripPlan.city 必须是非空字符串。')
    if (!isString(plan.start_date)) throw new Error('TripPlan.start_date 必须是非空字符串。')
    if (!isString(plan.end_date)) throw new Error('TripPlan.end_date 必须是非空字符串。')
    if (!isArray(plan.days, isDayPlan) || plan.days.length === 0) {
        throw new Error('TripPlan.days 至少包含一天行程。')
    }
    if (!isArray(plan.weather_info, isWeatherInfo)) {
        throw new Error('TripPlan.weather_info 必须是天气信息数组。')
    }
    if (!isString(plan.overall_suggestions)) {
        throw new Error('TripPlan.overall_suggestions 必须是非空字符串。')
    }
}

export function validateTripRequest(raw: unknown): raw is TripRequest | null {
    if (raw === null || raw === undefined) return true
    if (typeof raw !== 'object') return false

    const request = raw as TripRequest
    if (!isString(request.city)) return false
    if (!isString(request.start_date)) return false
    if (!isString(request.end_date)) return false
    if (
        request.travel_days !== undefined &&
        (typeof request.travel_days !== 'number' || !Number.isInteger(request.travel_days))
    ) {
        return false
    }
    if (request.preferences && !Array.isArray(request.preferences)) return false
    if (
        request.preferences &&
        !request.preferences.every(item => typeof item === 'string' && item.trim().length > 0)
    ) {
        return false
    }
    return true
}
