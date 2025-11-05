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

function formatSchema(schema: unknown) {
    return JSON.stringify(schema, null, 2)
}

function buildJsonOnlyRequirements(schemaLabel: string) {
    return [
        '## 输出规范',
        '1. 仅返回一段合法 JSON，禁止附加任何解释、前缀或 Markdown 代码块标记。',
        '2. JSON 必须完全符合下方 Schema，未提及的可选字段请直接省略，不要输出 null。',
        '3. 确保所有字符串使用双引号包裹，布尔与数字类型保持原生格式。',
        `4. 如果无法生成，请返回 {"error":"${schemaLabel} generation failed"} 并说明原因。`
    ].join('\n')
}

function buildExtractionSystemPrompt() {
    return [
        '## 角色',
        '你是一名旅行需求抽取助手，负责从自然语言中提取结构化字段。',
        '## 任务目标',
        '读取用户的旅行描述，并按 TripRequest Schema 抽取对应字段。',
        buildJsonOnlyRequirements('TripRequest'),
        '## TripRequest Schema',
        formatSchema(TRIP_REQUEST_SCHEMA)
    ].join('\n\n')
}

function buildExtractionUserPrompt(prompt: string) {
    return [
        '## 用户旅行描述',
        prompt.trim(),
        '## 补充说明',
        '- 如未提及字段请省略。',
        '- 日期、预算等信息保持原格式。'
    ].join('\n\n')
}

function buildPlanSystemPrompt() {
    return [
        '## 角色',
        '你是一名资深旅行行程规划师，擅长按照用户偏好输出结构化计划。',
        '## 任务目标',
        '根据给定的 TripRequest，制定覆盖每日行程、预算与天气信息的 TripPlan。',
        buildJsonOnlyRequirements('TripPlan'),
        '## TripPlan Schema',
        formatSchema(TRIP_PLAN_SCHEMA)
    ].join('\n\n')
}

function buildPlanUserPrompt(request: TripRequest, hint?: string) {
    const sections = [
        '## TripRequest 输入',
        JSON.stringify(request, null, 2)
    ]

    if (hint?.trim()) {
        sections.push('## 额外偏好说明', hint.trim())
    }

    sections.push(
        '## 规划提示',
        '- 行程需覆盖全部日期，保持日序连续。',
        '- attractions 至少提供 2 个条目，并包含分类、开放时间或时长估计。',
        '- meals 字段需包含三餐或给出合理空缺说明。'
    )

    return sections.join('\n\n')
}

function parseFirstJsonObject(text: string): any {
    const trimmed = text.trim()
    if (!trimmed) {
        throw new Error('模型未返回任何内容。')
    }

    if (trimmed.startsWith('{')) {
        return JSON.parse(trimmed)
    }

    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
    if (fenced) {
        return JSON.parse(fenced[1])
    }

    const match = trimmed.match(/\{[\s\S]*\}/)
    if (match) {
        const candidate = match[0]
        // 尝试平衡大括号，避免提前截断
        let depth = 0
        let endIndex = -1
        for (let i = 0; i < trimmed.length; i += 1) {
            const char = trimmed[i]
            if (char === '{') {
                depth += 1
                if (depth === 1 && endIndex === -1) {
                    endIndex = i
                }
            } else if (char === '}') {
                depth -= 1
                if (depth === 0) {
                    const jsonSlice = trimmed.slice(endIndex, i + 1)
                    try {
                        return JSON.parse(jsonSlice)
                    } catch {
                        // continue searching
                    }
                }
            }
        }

        return JSON.parse(candidate)
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
                content: buildExtractionSystemPrompt()
            },
            {
                role: 'user',
                content: buildExtractionUserPrompt(prompt)
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
                content: buildPlanSystemPrompt()
            },
            {
                role: 'user',
                content: buildPlanUserPrompt(request, options.userPrompt)
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
