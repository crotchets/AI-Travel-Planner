import type { TripPlan, TripPlanRecord, TripPlanRow, TripRequest } from '../types/trip'

export const TRIP_TABLE_NAME = 'trip_plan'

export function mapTripRowToRecord(row: TripPlanRow): TripPlanRecord {
    return {
        id: row.id,
        user_id: row.user_id,
        created_at: row.created_at,
        updated_at: row.updated_at,
        request: row.request ?? null,
        city: row.city,
        start_date: row.start_date,
        end_date: row.end_date,
        days: Array.isArray(row.plan_days) ? row.plan_days : [],
        weather_info: Array.isArray(row.weather) ? row.weather : [],
        overall_suggestions: row.overall_suggestions,
        budget: row.budget ?? undefined
    }
}

export function buildTripInsertPayload(plan: TripPlan, userId: string, request: TripRequest | null) {
    return {
        user_id: userId,
        city: plan.city,
        start_date: plan.start_date,
        end_date: plan.end_date,
        plan_days: plan.days,
        weather: plan.weather_info,
        overall_suggestions: plan.overall_suggestions,
        budget: plan.budget ?? null,
        request: request ?? null
    }
}

export function buildTripUpdatePayload(plan: TripPlan, request: TripRequest | null) {
    return {
        city: plan.city,
        start_date: plan.start_date,
        end_date: plan.end_date,
        plan_days: plan.days,
        weather: plan.weather_info,
        overall_suggestions: plan.overall_suggestions,
        budget: plan.budget ?? null,
        request: request ?? null
    }
}
