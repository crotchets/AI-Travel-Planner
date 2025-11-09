export type ExpenseCategoryKey =
    | 'transport'
    | 'accommodation'
    | 'meal'
    | 'ticket'
    | 'shopping'
    | 'entertainment'
    | 'other'

export type PaymentMethodKey = 'cash' | 'credit_card' | 'debit_card' | 'mobile_payment' | 'other'

export type ExpenseSource = 'manual' | 'voice'

export interface ExpenseRecord {
    id: string
    trip_id: string
    user_id?: string | null
    amount: number
    currency?: string | null
    category: ExpenseCategoryKey
    payment_method: PaymentMethodKey
    spent_at: string
    description?: string | null
    created_at: string
    updated_at?: string | null
    source?: ExpenseSource | null
}

export interface ExpenseInsertInput {
    trip_id: string
    amount: number
    currency?: string | null
    category: ExpenseCategoryKey
    payment_method: PaymentMethodKey
    spent_at: string
    description?: string | null
    source?: ExpenseSource | null
}

export interface ExpenseUpdateInput {
    amount?: number
    currency?: string | null
    category?: ExpenseCategoryKey
    payment_method?: PaymentMethodKey
    spent_at?: string
    description?: string | null
    source?: ExpenseSource | null
}

export interface ExpenseStatsCategory {
    category: ExpenseCategoryKey
    amount: number
    count: number
    ratio: number
}

export interface ExpenseStatsByDate {
    date: string
    amount: number
}

export interface ExpenseStatsResponse {
    trip_id: string
    total_spent: number
    budget_total: number | null
    budget_delta: number | null
    by_category: ExpenseStatsCategory[]
    by_date: ExpenseStatsByDate[]
}

export interface ExpenseStatsView {
    tripId: string
    totalSpent: number
    budgetTotal: number | null
    budgetDelta: number | null
    byCategory: ExpenseStatsCategory[]
    byDate: ExpenseStatsByDate[]
}

export type ExpenseAnalysisBudgetStatus = 'over_budget' | 'under_budget' | 'on_track'

export interface ExpenseAnalysisObservation {
    title: string
    detail: string
}

export interface ExpenseAnalysisResponse {
    tripId: string
    generatedAt: string
    summary: string
    budgetStatus: ExpenseAnalysisBudgetStatus
    spendingOverview: string[]
    keyObservations: ExpenseAnalysisObservation[]
    recommendations: string[]
    savingTips: string[]
    riskWarnings: string[]
}
