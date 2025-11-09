import type { ExpenseCategoryKey, PaymentMethodKey } from '../types/expense'

export const EXPENSE_CATEGORY_CATALOG: Array<{
    value: ExpenseCategoryKey
    label: string
    keywords: string[]
    color: string
}> = [
        { value: 'transport', label: '交通', keywords: ['交通', '地铁', '公交', '打车', '出租', '滴滴', '车票'], color: '#2563eb' },
        { value: 'accommodation', label: '住宿', keywords: ['住宿', '酒店', '民宿', '客栈'], color: '#22c55e' },
        { value: 'meal', label: '餐饮', keywords: ['餐饮', '吃饭', '午餐', '早餐', '晚餐', '餐厅', '美食'], color: '#f97316' },
        { value: 'ticket', label: '门票', keywords: ['门票', '景点', '门票费', '入场'], color: '#e11d48' },
        { value: 'shopping', label: '购物', keywords: ['购物', '买', '纪念品', '特产'], color: '#8b5cf6' },
        { value: 'entertainment', label: '娱乐', keywords: ['娱乐', '演出', '歌', '电影', '按摩', '体验'], color: '#10b981' },
        { value: 'other', label: '其他', keywords: ['其他', '杂项', '费用', '支出'], color: '#6b7280' }
    ]

export const PAYMENT_METHOD_CATALOG: Array<{
    value: PaymentMethodKey
    label: string
    keywords: string[]
}> = [
        { value: 'cash', label: '现金', keywords: ['现金'] },
        { value: 'credit_card', label: '信用卡', keywords: ['信用卡', '刷卡'] },
        { value: 'debit_card', label: '借记卡', keywords: ['借记卡', '银行卡'] },
        { value: 'mobile_payment', label: '移动支付', keywords: ['支付宝', '微信', '手机支付', '扫码'] },
        { value: 'other', label: '其他', keywords: ['其他'] }
    ]

export const EXPENSE_CATEGORY_VALUES: ExpenseCategoryKey[] = EXPENSE_CATEGORY_CATALOG.map(item => item.value)
export const PAYMENT_METHOD_VALUES: PaymentMethodKey[] = PAYMENT_METHOD_CATALOG.map(item => item.value)
