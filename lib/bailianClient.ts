import type { TripPlan, TripRequest } from '../types/trip'

export type ChatCompletionMessage = {
    role: 'system' | 'user' | 'assistant'
    content: string
}

interface BailianChatCompletionOptions {
    model?: string
    messages: ChatCompletionMessage[]
    temperature?: number
    responseFormat?: unknown
    timeoutMs?: number
}

interface BailianChatCompletionResponseChoice {
    message?: {
        content?: string
    }
}

interface BailianChatCompletionResponse {
    choices?: BailianChatCompletionResponseChoice[]
}

const DEFAULT_BASE_URL = 'https://dashscope.aliyuncs.com/compatible-mode/v1'

const TRIP_REQUEST_SCHEMA = {
    type: 'object',
    required: ['city', 'start_date', 'end_date'],
    additionalProperties: false,
    properties: {
        city: { type: 'string', description: '旅行目的地城市，必填。例如：杭州。' },
        start_date: { type: 'string', description: '旅行开始日期，ISO8601 格式，例如 2025-05-01。' },
        end_date: { type: 'string', description: '旅行结束日期，ISO8601 格式，例如 2025-05-05。' },
        travel_days: {
            type: 'integer',
            minimum: 1,
            description: '旅行天数，可选。若能推导请填写，否则省略。'
        },
        transportation: {
            type: 'string',
            description: '交通偏好（公共交通/public、自驾/self-driving、步行/walking、综合/mixed 等）'
        },
        accommodation: {
            type: 'string',
            description: '住宿偏好（经济型/budget、精品/boutique、亲子/family、商务/business、奢华/luxury 等）'
        },
        preferences: {
            type: 'array',
            description: '旅行兴趣偏好标签数组，例如 ["美食", "文化"]。',
            items: { type: 'string' }
        },
        budget_level: {
            type: 'string',
            description: '预算等级（economy/moderate/premium 等）。'
        },
        free_text_input: {
            type: 'string',
            description: '对行程的额外自由描述。'
        }
    }
}

const TRIP_PLAN_SCHEMA = {
    type: 'object',
    required: ['city', 'start_date', 'end_date', 'days', 'weather_info', 'overall_suggestions'],
    additionalProperties: false,
    properties: {
        city: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        days: {
            type: 'array',
            minItems: 1,
            items: {
                type: 'object',
                required: ['date', 'day_index', 'attractions', 'meals'],
                additionalProperties: false,
                properties: {
                    date: { type: 'string', description: '当天日期' },
                    day_index: {
                        type: 'integer',
                        minimum: 1,
                        description: '从 1 开始的行程天数索引'
                    },
                    description: { type: 'string' },
                    transportation: { type: 'string' },
                    accommodation: { type: 'string' },
                    hotel: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            name: { type: 'string' },
                            address: { type: 'string' },
                            rating: { type: 'number' },
                            price_range: { type: 'string' },
                            latitude: { type: 'number' },
                            longitude: { type: 'number' },
                            distance: { type: 'string' },
                            contact: { type: 'string' }
                        }
                    },
                    attractions: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['name'],
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string' },
                                description: { type: 'string' },
                                category: { type: 'string' },
                                address: { type: 'string' },
                                latitude: { type: 'number' },
                                longitude: { type: 'number' },
                                rating: { type: 'number' },
                                estimated_duration_hours: { type: 'number' },
                                ticket_price: { type: 'number' },
                                currency: { type: 'string' },
                                image_url: { type: 'string' }
                            }
                        }
                    },
                    meals: {
                        type: 'array',
                        items: {
                            type: 'object',
                            required: ['name', 'type'],
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string' },
                                type: { type: 'string' },
                                description: { type: 'string' },
                                address: { type: 'string' },
                                estimated_cost: { type: 'number' },
                                currency: { type: 'string' }
                            }
                        }
                    }
                }
            }
        },
        weather_info: {
            type: 'array',
            items: {
                type: 'object',
                required: ['date', 'temperature', 'condition'],
                additionalProperties: false,
                properties: {
                    date: { type: 'string' },
                    temperature: { type: 'number' },
                    condition: { type: 'string' },
                    wind: { type: 'string' },
                    humidity: { type: 'number' }
                }
            }
        },
        overall_suggestions: { type: 'string' },
        budget: {
            type: 'object',
            additionalProperties: false,
            properties: {
                total: { type: 'number' },
                currency: { type: 'string' },
                notes: { type: 'string' },
                categories: {
                    type: 'array',
                    items: {
                        type: 'object',
                        required: ['label', 'amount'],
                        additionalProperties: false,
                        properties: {
                            label: { type: 'string' },
                            amount: { type: 'number' },
                            currency: { type: 'string' }
                        }
                    }
                }
            }
        }
    }
}

function ensureEnv(name: string, value: string | undefined) {
    if (!value) {
        throw new Error(`缺少环境变量 ${name}，请在部署前配置。`)
    }
}

function parseFirstJsonObject(text: string): any {
    const trimmed = text.trim()
    if (!trimmed) {
        throw new Error('模型未返回任何内容。')
    }

    if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed)
    }

    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
        return JSON.parse(match[0])
    }

    throw new Error('未能在模型返回中解析出 JSON 内容。')
}

export async function callBailianChatCompletion({
    model,
    messages,
    temperature,
    responseFormat,
    timeoutMs = 60000
}: BailianChatCompletionOptions) {
    const apiKey = process.env.BAILIAN_API_KEY
    const baseUrl = process.env.BAILIAN_API_BASE_URL ?? DEFAULT_BASE_URL
    const defaultModel = process.env.BAILIAN_DEFAULT_MODEL ?? 'qwen-plus'

    ensureEnv('BAILIAN_API_KEY', apiKey)

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model ?? defaultModel,
                messages,
                temperature,
                response_format: responseFormat
            }),
            signal: controller.signal
        })

        if (!response.ok) {
            const errorText = await response.text()
            throw new Error(`百炼接口调用失败：${response.status} ${response.statusText} ${errorText}`)
        }

        const data = (await response.json()) as BailianChatCompletionResponse
        return data
    } finally {
        clearTimeout(timeout)
    }
}

export async function extractTripRequestFromPrompt(prompt: string): Promise<TripRequest> {
    const model = process.env.BAILIAN_TRIP_REQUEST_MODEL ?? process.env.BAILIAN_DEFAULT_MODEL
    const response = await callBailianChatCompletion({
        model,
        messages: [
            {
                role: 'system',
                content:
                    '你是一名旅行助手，需要从用户提供的自然语言描述中提取结构化的旅行需求。仅返回 JSON，不添加额外文字。'
            },
            {
                role: 'user',
                content: `请从以下描述中提取旅行需求字段，未提及的字段可忽略：\n${prompt}`
            }
        ],
        temperature: 0,
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'TripRequestSchema',
                strict: true,
                schema: TRIP_REQUEST_SCHEMA
            }
        }
    })

    const content = response.choices?.[0]?.message?.content
    if (!content) {
        throw new Error('百炼未返回提取结果。')
    }

    const json = parseFirstJsonObject(content)

    return {
        city: typeof json.city === 'string' ? json.city.trim() : '',
        start_date: typeof json.start_date === 'string' ? json.start_date.trim() : '',
        end_date: typeof json.end_date === 'string' ? json.end_date.trim() : '',
        travel_days:
            typeof json.travel_days === 'number' && Number.isFinite(json.travel_days)
                ? json.travel_days
                : undefined,
        transportation: typeof json.transportation === 'string' ? json.transportation.trim() : undefined,
        accommodation: typeof json.accommodation === 'string' ? json.accommodation.trim() : undefined,
        preferences: Array.isArray(json.preferences)
            ? json.preferences.filter((item: unknown) => typeof item === 'string' && item.trim().length > 0)
            : undefined,
        budget_level: typeof json.budget_level === 'string' ? json.budget_level.trim() : undefined,
        free_text_input: typeof json.free_text_input === 'string' ? json.free_text_input.trim() : undefined
    }
}

export async function generateTripPlanFromRequest(
    request: TripRequest,
    options: { userPrompt?: string; temperature?: number } = {}
): Promise<TripPlan> {
    const model = process.env.BAILIAN_TRIP_PLAN_MODEL ?? process.env.BAILIAN_DEFAULT_MODEL

    const response = await callBailianChatCompletion({
        model,
        messages: [
            {
                role: 'system',
                content:
                    '你是一名专业旅行行程规划师，请基于输入的 TripRequest 生成详细的多日 TripPlan，并按要求返回 JSON。'
            },
            {
                role: 'user',
                content: `TripRequest: ${JSON.stringify(request)}${
                    options.userPrompt ? `\n额外说明：${options.userPrompt}` : ''
                }\n请返回符合 TripPlanSchema 的 JSON。`
            }
        ],
        temperature: options.temperature ?? 0.6,
        responseFormat: {
            type: 'json_schema',
            json_schema: {
                name: 'TripPlanSchema',
                strict: true,
                schema: TRIP_PLAN_SCHEMA
            }
        }
    })

    const content = response.choices?.[0]?.message?.content
    if (!content) {
        throw new Error('百炼未返回行程规划结果。')
    }

    const json = parseFirstJsonObject(content)

    return json as TripPlan
}
