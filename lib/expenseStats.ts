import type { ExpenseRecord, ExpenseStatsByDate, ExpenseStatsCategory, ExpenseStatsResponse } from '../types/expense'

export interface ExpenseStatsSummary {
    tripId: string
    totalSpent: number
    budgetTotal: number | null
    budgetDelta: number | null
    byCategory: ExpenseStatsCategory[]
    byDate: ExpenseStatsByDate[]
    response: ExpenseStatsResponse
}

function roundCurrency(value: number) {
    return Number(value.toFixed(2))
}

export function buildCategoryStats(records: ExpenseRecord[], total: number): ExpenseStatsCategory[] {
    const map = new Map<string, { amount: number; count: number }>()
    records.forEach(record => {
        const key = record.category
        const current = map.get(key) ?? { amount: 0, count: 0 }
        current.amount += record.amount
        current.count += 1
        map.set(key, current)
    })

    return Array.from(map.entries())
        .map(([category, value]) => ({
            category: category as ExpenseStatsCategory['category'],
            amount: roundCurrency(value.amount),
            count: value.count,
            ratio: total > 0 ? value.amount / total : 0
        }))
        .sort((a, b) => b.amount - a.amount)
}

export function buildDateStats(records: ExpenseRecord[]): ExpenseStatsByDate[] {
    const map = new Map<string, number>()
    records.forEach(record => {
        const dateKey = record.spent_at
        const current = map.get(dateKey) ?? 0
        map.set(dateKey, current + record.amount)
    })

    return Array.from(map.entries())
        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
        .map(([date, amount]) => ({ date, amount: roundCurrency(amount) }))
}

export function summarizeExpenseStats(
    tripId: string,
    records: ExpenseRecord[],
    budgetTotal: number | null
): ExpenseStatsSummary {
    const totalSpent = records.reduce((total, record) => total + record.amount, 0)
    const roundedTotal = roundCurrency(totalSpent)
    const byCategory = buildCategoryStats(records, totalSpent)
    const byDate = buildDateStats(records)
    const budgetDelta =
        budgetTotal !== null && budgetTotal !== undefined ? roundCurrency(budgetTotal - roundedTotal) : null

    return {
        tripId,
        totalSpent: roundedTotal,
        budgetTotal,
        budgetDelta,
        byCategory,
        byDate,
        response: {
            trip_id: tripId,
            total_spent: roundedTotal,
            budget_total: budgetTotal,
            budget_delta: budgetDelta,
            by_category: byCategory,
            by_date: byDate
        }
    }
}
