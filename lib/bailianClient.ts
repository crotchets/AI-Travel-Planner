import type { RuntimeConfig } from './runtimeConfig'
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
    runtimeConfig?: RuntimeConfig | null
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

const DEFAULT_TIMEOUT_FALLBACK_MS = 120_000

function parseTimeoutValue(value: string | undefined | null) {
    if (!value) return null
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed) && parsed > 0) {
        return parsed
    }
    return null
}

function resolveTimeoutMs(runtimeConfig?: RuntimeConfig | null) {
    const runtimeValue = runtimeConfig?.NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS
    const runtimeParsed = parseTimeoutValue(runtimeValue)
    if (runtimeParsed !== null) {
        return runtimeParsed
    }
    const envParsed = parseTimeoutValue(process.env.NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS)
    if (envParsed !== null) {
        return envParsed
    }
    return DEFAULT_TIMEOUT_FALLBACK_MS
}

type TripFormOption = {
    value: string
    label: string
}

const TRIP_FORM_TRANSPORTATION_OPTIONS: TripFormOption[] = [
    { value: 'public', label: '公共交通' },
    { value: 'self-driving', label: '自驾' },
    { value: 'walking', label: '步行' },
    { value: 'mixed', label: '综合出行' }
]

const TRIP_FORM_ACCOMMODATION_OPTIONS: TripFormOption[] = [
    { value: 'budget', label: '经济型' },
    { value: 'boutique', label: '精品/设计' },
    { value: 'family', label: '亲子友好' },
    { value: 'business', label: '商务舒适' },
    { value: 'luxury', label: '高端奢华' }
]

const TRIP_FORM_BUDGET_LEVEL_OPTIONS: TripFormOption[] = [
    { value: 'economy', label: '经济型' },
    { value: 'moderate', label: '适中' },
    { value: 'premium', label: '高消费' }
]

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
        city: { type: 'string', description: '本次行程主要覆盖的核心城市名称，例如 “上海”。' },
        start_date: { type: 'string', description: '行程开始日期，需采用 ISO8601 (YYYY-MM-DD) 格式。' },
        end_date: { type: 'string', description: '行程结束日期，需采用 ISO8601 (YYYY-MM-DD) 格式。' },
        days: {
            type: 'array',
            minItems: 1,
            description: '按日期排序的每日行程数组，每个元素对应行程的一天。',
            items: {
                type: 'object',
                required: ['date', 'day_index', 'attractions', 'meals'],
                additionalProperties: false,
                properties: {
                    date: { type: 'string', description: '当天日期，ISO8601 (YYYY-MM-DD) 格式。' },
                    day_index: {
                        type: 'integer',
                        minimum: 1,
                        description: '从 1 开始的行程天数索引，需与数组顺序一致。'
                    },
                    description: { type: 'string', description: '当天行程的概述或主题描述。' },
                    transportation: {
                        type: 'string',
                        description: '当天主要的交通方式或移动安排，如公共交通、自驾等。'
                    },
                    accommodation: {
                        type: 'string',
                        description: '住宿安排或入住区域的简述，未确定可给出参考建议。'
                    },
                    hotel: {
                        type: 'object',
                        additionalProperties: false,
                        description: '当天推荐入住的酒店信息。',
                        properties: {
                            name: { type: 'string', description: '酒店名称。' },
                            address: { type: 'string', description: '酒店地址。' },
                            rating: { type: 'number', description: '酒店评分，范围建议 0-5。' },
                            price_range: { type: 'string', description: '价格区间或房价说明。' },
                            latitude: { type: 'number', description: '酒店位置的纬度。' },
                            longitude: { type: 'number', description: '酒店位置的经度。' },
                            distance: { type: 'string', description: '酒店与主要景点或市中心的距离描述。' },
                            contact: { type: 'string', description: '酒店联系方式（电话、官网等）。' }
                        }
                    },
                    attractions: {
                        type: 'array',
                        description: '当天推荐游览的景点列表，需至少包含两个条目。',
                        items: {
                            type: 'object',
                            required: ['name'],
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string', description: '景点名称。' },
                                description: { type: 'string', description: '景点亮点或游览建议。' },
                                category: { type: 'string', description: '景点类型，例如 “文化” 或 “自然”。' },
                                address: { type: 'string', description: '景点地址或所在区域。' },
                                latitude: { type: 'number', description: '景点纬度。' },
                                longitude: { type: 'number', description: '景点经度。' },
                                rating: { type: 'number', description: '参考评分，范围建议 0-5。' },
                                estimated_duration_hours: {
                                    type: 'number',
                                    description: '预估游玩时长（小时），支持小数。'
                                },
                                ticket_price: { type: 'number', description: '门票价格，使用 currency 指定货币。' },
                                currency: { type: 'string', description: '门票价格使用的货币单位，例如 “CNY”。' },
                                image_url: { type: 'string', description: '景点配图或参考图片链接，可选。' }
                            }
                        }
                    },
                    meals: {
                        type: 'array',
                        description: '当天的餐饮安排列表，建议给出早餐/午餐/晚餐或合理说明。',
                        items: {
                            type: 'object',
                            required: ['name', 'type'],
                            additionalProperties: false,
                            properties: {
                                name: { type: 'string', description: '餐厅或餐食名称。' },
                                type: {
                                    type: 'string',
                                    description: '餐食类型（breakfast/lunch/dinner/snack），或其它补充说明。'
                                },
                                description: { type: 'string', description: '推荐理由或菜品亮点，可为空。' },
                                address: { type: 'string', description: '餐厅地址或所在区域。' },
                                estimated_cost: { type: 'number', description: '预估人均消费金额。' },
                                currency: { type: 'string', description: '消费金额使用的货币单位，例如 “CNY”。' }
                            }
                        }
                    }
                }
            }
        },
        weather_info: {
            type: 'array',
            description: '与行程日期对应的天气预报数组，可包含每日的温度、天气状况等信息。',
            items: {
                type: 'object',
                required: ['date', 'temperature', 'condition'],
                additionalProperties: false,
                properties: {
                    date: { type: 'string', description: '天气对应的日期，ISO8601 (YYYY-MM-DD) 格式。' },
                    temperature: { type: 'number', description: '当日平均或白天温度（摄氏度）。' },
                    condition: { type: 'string', description: '天气概况，例如 “晴” 或 “小雨”。' },
                    wind: { type: 'string', description: '风向与风力描述。' },
                    humidity: { type: 'number', description: '相对湿度 (0-100)。' }
                }
            }
        },
        overall_suggestions: {
            type: 'string',
            description: '针对整段行程的综合建议或温馨提示，可总结注意事项、交通与行李建议等。'
        },
        budget: {
            type: 'object',
            additionalProperties: false,
            description: '行程预算信息，可在用户要求时给出总预算与分项建议。如果用户未提及预算，自行推测预算水平并提供合理建议。',
            properties: {
                total: { type: 'number', description: '预计总预算金额。' },
                currency: { type: 'string', description: '预算使用的货币单位，例如 “CNY”。' },
                notes: { type: 'string', description: '其它补充说明，如预算假设、费用包含范围。' },
                categories: {
                    type: 'array',
                    description: '预算分项列表，例如交通、餐饮、门票等细分项目。',
                    items: {
                        type: 'object',
                        required: ['label', 'amount'],
                        additionalProperties: false,
                        properties: {
                            label: { type: 'string', description: '预算分项名称，从' },
                            amount: { type: 'number', description: '该分项预计费用金额。' },
                            currency: { type: 'string', description: '该分项使用的货币单位，默认沿用总预算货币。' }
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

function getCurrentIsoDate() {
    try {
        return new Date().toISOString().slice(0, 10)
    } catch {
        return '未知日期'
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

function formatOptionGroup(label: string, options: TripFormOption[]) {
    const values = options.map(option => `${option.value}（${option.label}）`).join('、')
    return `- ${label}: ${values}`
}

function buildExtractionSystemPrompt() {
    const today = getCurrentIsoDate()
    return [
        '## 角色',
        '你是一名旅行需求抽取助手，负责从自然语言中提取结构化字段。',
        '## 任务目标',
        '读取用户的旅行描述，并按 TripRequest Schema 抽取对应字段。',
        '## 当前日期参考',
        `今天日期：${today}。如果用户未给出年份，请结合当前年份与上下文进行合理判断，不要编造明显不合逻辑的日期。`,
        '## 表单枚举选项',
        formatOptionGroup('transportation', TRIP_FORM_TRANSPORTATION_OPTIONS),
        formatOptionGroup('accommodation', TRIP_FORM_ACCOMMODATION_OPTIONS),
        formatOptionGroup('budget_level', TRIP_FORM_BUDGET_LEVEL_OPTIONS),
        '- preferences 字段为自由文本标签数组，请保持原样或拆分用户描述中的兴趣关键词。',
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
    const today = getCurrentIsoDate()
    return [
        '## 角色',
        '你是一名资深旅行行程规划师，擅长按照用户偏好输出结构化计划。',
        '## 任务目标',
        '根据给定的 TripRequest，制定覆盖每日行程、预算与天气信息的 TripPlan。',
        '## 当前日期参考',
        `今天日期：${today}。请确保规划的日期序列与 TripRequest 中的日期保持一致，不要产生明显早于今天的历史行程（除非用户明确要求回顾）。`,
        '## 表单枚举选项对照',
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
        '- 为每个 day.description 提供 1-2 句话概述当天主题或亮点。',
        '- meals 字段需包含三餐或给出合理空缺说明。',
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
    timeoutMs,
    runtimeConfig
}: BailianChatCompletionOptions) {
    const apiKey = runtimeConfig?.NEXT_PUBLIC_BAILIAN_API_KEY ?? process.env.NEXT_PUBLIC_BAILIAN_API_KEY
    const baseUrl = runtimeConfig?.NEXT_PUBLIC_BAILIAN_API_BASE_URL ?? process.env.NEXT_PUBLIC_BAILIAN_API_BASE_URL ?? DEFAULT_BASE_URL
    const defaultModel = runtimeConfig?.NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL ?? process.env.NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL ?? 'qwen-plus'

    ensureEnv('NEXT_PUBLIC_BAILIAN_API_KEY', apiKey)

    const controller = new AbortController()
    const effectiveTimeout = timeoutMs ?? resolveTimeoutMs(runtimeConfig)
    const timeout = setTimeout(() => controller.abort(), effectiveTimeout)

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
    } catch (err) {
        if ((err as any)?.name === 'AbortError' || controller.signal.aborted) {
            throw new Error(`百炼接口调用超时（>${Math.round(effectiveTimeout / 1000)} 秒），请稍后重试或精简需求。`)
        }
        throw err
    } finally {
        clearTimeout(timeout)
    }
}

export async function extractTripRequestFromPrompt(
    prompt: string,
    runtimeConfig?: RuntimeConfig | null
): Promise<TripRequest> {
    const defaultModel = runtimeConfig?.NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL ?? process.env.NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL
    const model = runtimeConfig?.NEXT_PUBLIC_BAILIAN_TRIP_REQUEST_MODEL ?? defaultModel
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
        },
        runtimeConfig
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
    options: { userPrompt?: string; temperature?: number; runtimeConfig?: RuntimeConfig | null } = {}
): Promise<TripPlan> {
    const defaultModel = options.runtimeConfig?.NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL ?? process.env.NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL
    const model = options.runtimeConfig?.NEXT_PUBLIC_BAILIAN_TRIP_PLAN_MODEL ?? defaultModel

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
        },
        runtimeConfig: options.runtimeConfig
    })

    const content = response.choices?.[0]?.message?.content
    if (!content) {
        throw new Error('百炼未返回行程规划结果。')
    }

    const json = parseFirstJsonObject(content)

    return json as TripPlan
}
