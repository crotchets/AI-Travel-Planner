export type TransportationPreference = 'public' | 'self-driving' | 'walking' | 'mixed' | string

export type AccommodationPreference =
    | 'budget'
    | 'boutique'
    | 'family'
    | 'luxury'
    | 'business'
    | string

export interface TripRequest {
    city: string
    start_date: string
    end_date: string
    travel_days?: number
    transportation?: TransportationPreference
    accommodation?: AccommodationPreference
    preferences?: string[]
    budget_level?: 'economy' | 'moderate' | 'premium' | string
    free_text_input?: string
}

export interface WeatherInfo {
    date: string
    temperature: number
    condition: string
    wind?: string
    humidity?: number
}

export interface Meal {
    name: string
    type: 'breakfast' | 'lunch' | 'dinner' | 'snack' | string
    address?: string
    description?: string
    estimated_cost?: number
    currency?: string
}

export interface Attraction {
    name: string
    description?: string
    category?: string
    address?: string
    latitude?: number
    longitude?: number
    rating?: number
    estimated_duration_hours?: number
    ticket_price?: number
    currency?: string
    image_url?: string
}

export interface Hotel {
    name: string
    address?: string
    rating?: number
    price_range?: string
    latitude?: number
    longitude?: number
    distance?: string
    contact?: string
}

export interface DayPlan {
    date: string
    day_index: number
    description?: string
    transportation?: string
    accommodation?: string
    hotel?: Hotel
    attractions: Attraction[]
    meals: Meal[]
}

export interface BudgetCategory {
    label: string
    amount: number
    currency?: string
}

export interface Budget {
    total: number
    currency?: string
    categories: BudgetCategory[]
    notes?: string
}

export interface TripPlan {
    city: string
    start_date: string
    end_date: string
    days: DayPlan[]
    weather_info: WeatherInfo[]
    overall_suggestions: string
    budget?: Budget
}

export interface TripPlanRecord extends TripPlan {
    id: string
    user_id: string
    created_at: string
    updated_at?: string
    request?: TripRequest | null
}

export interface TripPlanRow {
    id: string
    user_id: string
    city: string
    start_date: string
    end_date: string
    plan_days: DayPlan[]
    weather: WeatherInfo[]
    overall_suggestions: string
    budget: Budget | null
    request: TripRequest | null
    created_at: string
    updated_at?: string
}
