# AI 旅行规划师 Web 版产品需求文档（PRD）

## 1. 产品概述

- **产品名称**：AI Travel Planner（暂定）
- **产品定位**：面向自由行用户的智能旅行规划与辅助平台，提供语音/文字输入、AI 行程生成、预算管理以及实时旅行辅助。
- **目标用户**：具备一定自主旅行能力、希望提升规划效率的年轻家庭、情侣、朋友结伴旅行者，以及对行程规划缺乏经验的新手背包客。
- **核心价值**：利用大语言模型与语音交互，快速生成个性化旅行方案，降低旅行前期信息收集与规划成本，并在旅行过程中提供动态辅助。

### 1.1 当前进度（截至 2025-10）

> ✅ 模块化完成情况请查看 `docs/completed-modules.md`，下方表格保留整体时间线概览。

| 交付项 | 状态 | 说明 |
| --- | --- | --- |
| 项目基础架构 | ✅ 已完成 | 搭建 Next.js 15 + TypeScript + Tailwind + Supabase，配置 React Query、Zustand、ESLint。|
| 用户认证 | ✅ 已完成 | 集成 Supabase Auth，封装 `AuthProvider`/`ProtectedClient`，实现刷新会话与登录拦截。|
| 语音转写 API | ✅ 已完成 | 基于科大讯飞 WebSocket 实现 `/api/transcribe/iflytek`，支持前端上传 16k PCM 流并返回实时结果。|
| 仪表盘 MVP | ✅ 已完成 | 新增 `DashboardClient` 布局、行程表单占位、可拖拽分栏以及高德地图预览（官方 Loader 接入）。|
| 地图组件 | ✅ 已完成 | `MapPreview` 使用 `@amap/amap-jsapi-loader`，支持安全密钥、默认示意层及控件加载。|
| 首页体验 | ✅ 已完成 | 重构首页 Hero 与“快速入口”版块，提供规划、预算、行程入口。|
| 文档 & 配置 | ✅ 已完成 | 补充 README、环境变量模版及 PRD 初版；`copilot-instructions` 指导开发流程。|
| 待办：AI 行程生成 | ⏳ 未开始 | 需接入 LLM 与行程生成服务，当前仅有表单占位。|
| 待办：预算记账 | ⏳ 未开始 | 预算中心 UI 与 API 尚未实现，仅在 PRD 规划。|
| 待办：实时辅助/提醒 | ⏳ 未开始 | 相关服务、通知与地图路线规划待开发。|

## 2. 用户痛点与价值主张

| 用户痛点 | 产品价值 |
| --- | --- |
| 旅行规划信息碎片化、耗时长 | AI 汇总交通、住宿、景点、餐饮信息，生成结构化行程 |
| 缺乏预算掌控 | 自动预算拆分与支出跟踪，语音快速录入消费 |
| 难以随行程变化做快速调整 | 云端同步与实时 AI 调整建议，随时更新 |
| 多人同行偏好差异 | 收集旅行偏好，生成兼顾所有成员的方案 |

## 3. 用户画像

1. **年轻家庭**：30-40 岁，有 1-2 名儿童，注重安全与亲子体验，需要精细化日程安排。
2. **二人世界**：情侣/夫妻，注重浪漫景点与高品质餐饮，接受 AI 给出的个性化推荐。
3. **朋友结伴**：大学生或年轻白领，预算有限，需要性价比高的攻略，偏好特色体验。
4. **独行背包客**：注重自由灵活，想要轻量行程骨架与实时调整能力。

## 4. 目标与成功指标

- **业务目标**
  - MVP 内测期：500 名注册用户，日活 150+。
  - 上线 3 个月：行程生成成功率 ≥ 90%，月活 5,000。
- **用户体验指标**
  - 行程生成耗时 ≤ 15 秒。
  - 行程满意度调查均分 ≥ 4.2 / 5。
  - 语音识别准确率 ≥ 90%。
- **运营指标**
  - 日均行程保存数 ≥ 300。
  - 预算记录功能触达率 ≥ 60%。

## 5. 功能需求

### 5.1 模块总览

| 模块 | 描述 |
| --- | --- |
| 行程规划 | 语音/文字输入需求，AI 输出多日行程详情，可编辑、保存、分享 |
| 预算管理 | 自动预算拆分，按日/类别展示，语音记账 |
| 用户账户 | 注册登录、偏好设置、计划管理、同步 |
| 实时辅助 | 行程提醒、动态调整建议、地图导航集成 |
| 管理后台（V2+） | 行程模版管理、内容审核、数据大屏 |

### 5.2 用户故事 & 优先级

| 编号 | 用户故事 | 优先级 | 验收标准 |
| --- | --- | --- | --- |
| US1 | 作为用户，我想用语音描述旅行需求，让系统自动生成行程 | P0 | 提交语音后显示完整行程表，含每日安排、预算概览 |
| US2 | 作为用户，我想编辑行程中的某个景点，让 AI 重新调整当天安排 | P0 | 编辑后 10 秒内返回更新行程，并说明调整原因 |
| US3 | 作为用户，我需要保存行程并在手机/电脑查看 | P0 | 登录同一账号可查看、编辑之前的行程 |
| US4 | 作为用户，我想记录每天的花销 | P1 | 支持语音/手动添加、编辑、删除费用，自动分类统计并可导出报告 |
| US5 | 作为用户，我想通过地图查看景点位置与导航 | P1 | 行程页面嵌入地图标注景点，支持跳转导航 |
| US6 | 作为用户，我想与同行者分享行程 | P2 | 可生成分享链接或导出 PDF |

### 5.3 功能详述

#### 5.3.1 行程规划

- 语音/文字输入：收集目的地、日期范围、预算、人数、偏好标签。
- 行程生成：调用 LLM，根据偏好推荐交通、住宿、日程景点、餐饮。
- 可视化展示：按日分卡片，地图标点，支持查看详情（门票、开放时间、地址）。
- 行程调整：支持拖拽、删除、替换景点；自动更新时间轴与预算。
- 预算回溯：行程详情页汇总对应行程的费用统计，对比原始预算并给出超支/节省建议。提示可能的优化策略（例如减少购物或增加体验预算）。
- 多方案对比（V2）：生成 2-3 个备选方案。

#### 5.3.2 预算管理

- 行程关联：预算中心以“选择行程”作为入口，所有费用记录、统计与导出均绑定具体行程，可快速切换行程查看各自的支出表现。
- 预算拆分：根据输入预算自动分配到交通/住宿/餐饮/门票等。
- 预算提醒：超过预算项时高亮提示。
- 费用记录：
  - 支持添加、编辑、删除单条费用，必填字段包含金额、类别、日期、支付方式。
  - 默认支持 7 种费用类别（交通、住宿、餐饮、门票、购物、娱乐、其他），需允许后续扩展。
  - 默认支持 5 种支付方式（现金、信用卡、借记卡、移动支付、其他），界面需以枚举下拉呈现。
  - 每条费用允许填写备注，备注支持 Markdown 简易格式（加粗、斜体、列表）。
  - 费用日期采用日期选择器，默认定位到当前行程日期范围。
- 费用统计分析：
  - 自动计算总支出并与行程预算对比，显示差额与完成度百分比。
  - 按类别统计金额、笔数与预算占比，支持导出表格。
  - 按日期聚合支出，生成每日趋势数据，支持选择时间粒度（日/周）。
  - 可视化图表：类别饼图、每日支出柱状图（或折线图），支持切换显示指标。
- 数据导出：
  - 提供 Excel（SheetJS 实现）、CSV 两种原始数据导出格式，Excel 需包含公式与多 sheet（原始数据、统计分析）。
  - 导出费用报告（PDF/HTML），内容包含统计摘要、图表截图、预算对比说明。
  - 导出操作需支持筛选条件（日期范围、类别、支付方式）。
- 语音输入：
  - 集成讯飞语音识别 API，支持实时语音转文字，至少提供麦克风按钮/快捷键触发。
  - AI 解析语音内容（金额、类别、日期、描述、支付方式）自动填充费用表单，可在提交前手动校验。
  - 提供语音录入失败兜底流程（回退文字编辑、重新识别）。

#### 5.3.3 用户管理与数据同步

- 注册登录：邮箱+密码、第三方登录（可选 Supabase Auth/OAuth）。
- 偏好设置：保存常用预算区间、偏好类型、常赴城市。
- 云端同步：行程、预算、偏好通过 Supabase/Firestore 存储。
- 多端支持：Web 响应式；后续可扩展 PWA。

#### 5.3.4 实时旅行辅助

- 行程提醒：基于日程生成提醒（邮件/浏览器通知）。
- 动态更新：用户修改需求或出现突发情况（天气、景点关闭）时，AI 给出替代建议。
- 导航集成：调用高德/百度地图 Web API，支持打开 App 导航。

### 5.4 非功能需求

- **性能**：核心 API 平均响应时间 < 1.5s（除 LLM 调用）。
- **可靠性**：云端服务 99.5% 可用性；关键数据每日备份。
- **安全**：用户数据加密存储，遵循 GDPR/本地隐私法规；访问控制细粒度。
- **可扩展性**：微服务/Serverless 结构，支持新增 AI 模块。
- **可访问性**：符合 WCAG 2.1 AA，提供语音播报与键盘操作辅助。

## 6. 交互与信息架构

### 6.1 信息架构概览

1. 登录/注册
2. 仪表盘：展示近期计划、快速创建入口
3. 行程工作台：需求输入 → 行程生成 → 编辑 → 地图总览
4. 预算中心：预算拆分、支出记录、统计
5. 设置：个人信息、偏好、订阅通知

### 6.2 关键流程

1. **创建行程（MVP）**
   1. 进入“新建行程” → 语音/文字输入需求
   2. 前端将需求结构化为 JSON → 发送后端
   3. 后端调用行程生成服务（LLM + 数据接口）
   4. 返回多日行程，前端渲染时间轴、地图
   5. 用户可编辑并保存
2. **预算记录**
   1. 行程页点击“添加支出” → 语音输入金额与类别
   2. 语音识别服务转文本 → 后端解析金额与分类
   3. 写入预算数据库 → 更新前端图表
3. **实时调整**
   1. 用户在行程卡片中点击“调整当天”
   2. 前端收集上下文 → 后端调用 LLM 生成替换方案
   3. 前端提示变更与原因 → 用户确认后更新

### 6.3 线框草图（文字描述）

- **仪表盘**：顶部导航（首页/行程/预算/设置），中央卡片列出最近行程，右侧展示快速模板入口。
- **行程工作台**：左侧垂直日程列表，右侧为地图；顶部语音按钮与需求表单。
- **预算中心**：顶部预算概览卡片，下方日历/列表，右侧分类饼图。

## 7. 技术方案

### 7.1 前端

- **框架**：Next.js 15（App Router），TypeScript。
- **UI 库**：Tailwind CSS + Headless UI，地图区域定制组件。
- **状态管理**：React Query（数据请求）、Zustand（全局 UI 状态）。
- **语音交互**：浏览器端调用科大讯飞 Web API（或备选 Whisper API）。
- **地图服务**：高德地图 JS API，封装地图组件与标注层。
- **图表可视化**：优先选用 Recharts 或 ECharts for React，支持饼图、柱状/折线图动态刷新。
- **文件导出**：引入 SheetJS 处理 Excel，多工作表与公式生成；CSV 导出使用浏览器 Blob。

### 7.2 后端

- **部署形态**：Vercel Serverless Functions 或自建 Node.js（Express/Fastify）+ Edge Functions。
- **API 网关**：集中管理行程生成、预算、用户数据接口。
- **行程生成服务**：
  - Prompt 编排：根据用户需求、偏好、历史行程构造上下文。
  - 数据增强：接入第三方景点/酒店 API（后续迭代）。
  - LLM 供应商：OpenAI GPT-4o / Moonshot / 文心一言（可配置）。
- **预算引擎**：基于规则 + LLM 估算；记录存储于 Supabase Postgres。

### 7.3 数据与认证

- **数据库**：Supabase Postgres（行程、预算、用户、偏好表）。
- **认证**：Supabase Auth（邮箱/密码 + OAuth）。
- **存储**：行程、附件、图片存储在 Supabase Storage。
- **同步**：前端通过 Supabase Realtime 监听数据变更，实现多端同步。

### 7.4 集成与基础设施

- **CI/CD**：GitHub Actions → Vercel 部署。
- **日志**：Supabase Logs + Vercel Observability；自定义埋点上报。
- **配置管理**：使用 Vercel/Supabase 环境变量，结合 Doppler/1Password 共享。
- **合规**：隐私政策页面，提供数据导出与删除功能。

## 8. 数据结构（现网实现）

### 8.1 TypeScript 核心类型

#### TripRequest

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| city | string | ✅ | 旅行目的地城市。|
| start_date | string | ✅ | ISO8601 日期（YYYY-MM-DD），行程开始日。|
| end_date | string | ✅ | ISO8601 日期，行程结束日。|
| travel_days | number | ⭕️ | 行程天数，正整数，可由开始/结束日期推导时省略。|
| transportation | string | ⭕️ | 交通偏好，例如 `public`、`self-driving`、`walking`、`mixed`。|
| accommodation | string | ⭕️ | 住宿偏好，例如 `budget`、`boutique`、`family`、`luxury`。|
| preferences | string[] | ⭕️ | 兴趣标签数组，元素为非空字符串。|
| budget_level | string | ⭕️ | 预算档位，例如 `economy`、`moderate`、`premium`。|
| free_text_input | string | ⭕️ | 用户补充的自由描述文本。|

#### TripPlan

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| city | string | ✅ | 行程对应城市。|
| start_date | string | ✅ | ISO8601 日期，行程开始日。|
| end_date | string | ✅ | ISO8601 日期，行程结束日。|
| days | DayPlan[] | ✅ | 每日行程数组，至少 1 天。|
| weather_info | WeatherInfo[] | ✅ | 与行程日期对应的天气信息数组。|
| overall_suggestions | string | ✅ | 对整个行程的综合建议。|
| budget | Budget | ⭕️ | 预算汇总与分类结构，可为空缺。|

#### DayPlan

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| date | string | ✅ | ISO8601 日期，对应当天。|
| day_index | number | ✅ | 天数索引，从 1 开始。|
| description | string | ⭕️ | 当日摘要。|
| transportation | string | ⭕️ | 当日交通说明。|
| accommodation | string | ⭕️ | 当日住宿摘要。|
| hotel | Hotel | ⭕️ | 推荐酒店信息。|
| attractions | Attraction[] | ✅ | 当日景点列表。|
| meals | Meal[] | ✅ | 当日餐食列表。|

#### Attraction

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | ✅ | 景点名称。|
| description | string | ⭕️ | 景点描述或亮点。|
| category | string | ⭕️ | 景点类别标签。|
| address | string | ⭕️ | 详细地址。|
| latitude | number | ⭕️ | 纬度。|
| longitude | number | ⭕️ | 经度。|
| rating | number | ⭕️ | 推荐评分或热度。|
| estimated_duration_hours | number | ⭕️ | 建议停留时长（小时）。|
| ticket_price | number | ⭕️ | 门票价格。|
| currency | string | ⭕️ | 门票货币代码。|
| image_url | string | ⭕️ | 图片或宣传图链接。|

#### Meal

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| name | string | ✅ | 餐厅或餐食名称。|
| type | string | ✅ | 餐别，例如 `breakfast`、`lunch`、`dinner`。|
| description | string | ⭕️ | 推荐理由。|
| address | string | ⭕️ | 餐厅地址。|
| estimated_cost | number | ⭕️ | 预估消费。|
| currency | string | ⭕️ | 金额货币代码。|

#### WeatherInfo

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| date | string | ✅ | ISO8601 日期。|
| temperature | number | ✅ | 当日温度（℃）。|
| condition | string | ✅ | 天气描述，如“多云”。|
| wind | string | ⭕️ | 风力/风向。|
| humidity | number | ⭕️ | 相对湿度（百分比）。|

#### Budget 与 BudgetCategory

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| total | number | ✅ | 预算总额。|
| currency | string | ⭕️ | 总额货币代码。|
| notes | string | ⭕️ | 预算备注。|
| categories | BudgetCategory[] | ✅ | 预算分类数组。|

BudgetCategory 字段说明：

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| label | string | ✅ | 分类名称，例如“交通”。|
| amount | number | ✅ | 分类金额。|
| currency | string | ⭕️ | 分类货币代码，未提供时继承总额货币。|

#### ExpenseRecord（预算中心费用记录）

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| id | string | ✅ | 费用记录主键（UUID）。|
| trip_id | string | ✅ | 关联的行程 ID。|
| amount | number | ✅ | 费用金额，默认以行程货币计价。|
| currency | string | ⭕️ | 费用货币代码，缺省时沿用预算货币。|
| category | `"transport" \| "accommodation" \| "meal" \| "ticket" \| "shopping" \| "entertainment" \| "other"` | ✅ | 费用类别。|
| payment_method | `"cash" \| "credit_card" \| "debit_card" \| "mobile_payment" \| "other"` | ✅ | 支付方式。|
| spent_at | string | ✅ | 费用日期（ISO8601）。|
| description | string | ⭕️ | 费用备注，支持 Markdown。|
| created_at | string | ✅ | 创建时间戳。|
| updated_at | string | ⭕️ | 最近更新时间戳。|
| source | `"manual" \| "voice"` | ⭕️ | 录入来源，便于统计语音使用率。|

#### ExpenseStats（预算统计返回结构）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| trip_id | string | 当前统计对应的行程 ID。|
| total_spent | number | 行程累计支出。|
| budget_total | number \| null | 行程原始预算，来源于 TripPlan.budget.total。|
| budget_delta | number \| null | 预算差额（预算-支出）。|
| by_category | `{ category: ExpenseCategory, amount: number, count: number, ratio: number }[]` | 分类统计。|
| by_date | `{ date: string, amount: number }[]` | 日期维度统计。|

#### TripPlanRecord（返回给前端的保存结果）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | Supabase 行程记录主键。|
| user_id | string | 拥有者用户 ID。|
| city/start_date/end_date | string | 冗余行程基本信息。|
| days | DayPlan[] | 同 TripPlan.days。|
| weather_info | WeatherInfo[] | 同 TripPlan.weather_info。|
| overall_suggestions | string | 行程总结。|
| budget | `Budget \| undefined` | 预算详情，无则为 `undefined`。|
| request | `TripRequest \| null` | 创建该行程时的原始请求。|
| created_at | string | ISO 时间戳。|
| updated_at | `string \| undefined` | 最近更新时间。|

#### TripPlanRow（Supabase 查询返回的原始结构）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 行程主键。|
| user_id | string | 所属用户。|
| city | string | 行程城市。|
| start_date | string | 行程开始日期。|
| end_date | string | 行程结束日期。|
| plan_days | DayPlan[] | 存储于 JSONB 列。|
| weather | WeatherInfo[] | 存储于 JSONB 列。|
| overall_suggestions | string | 行程总结。|
| budget | `Budget \| null` | JSONB 列，可为空。|
| request | `TripRequest \| null` | 原始请求 JSON。|
| created_at | string | 记录创建时间。|
| updated_at | `string \| undefined` | 记录更新时间。|

### 8.2 百炼模型 JSON Schema

- **TripRequestSchema**：与上文 TripRequest 字段完全一致，强制 `city`、`start_date`、`end_date` 为必填，`additionalProperties: false` 防止多余字段。若模型无法生成，需返回 `{"error":"TripRequest generation failed"}`。
- **TripPlanSchema**：约束 TripPlan 结构，包含嵌套的 DayPlan/Attraction/Meal/WeatherInfo/Budget 字段，所有数组均要求元素为对象且去除未定义字段。错误时返回 `{"error":"TripPlan generation failed"}`。

这两个 Schema 以 `response_format.type = 'json_schema'` 方式传递给百炼接口，保证模型输出严格符合前端/数据库类型定义。

### 8.3 Supabase 表结构

当前仅持久化行程记录，使用 `trip_plan` 表：

| 字段 | 类型（建议） | 说明 |
| --- | --- | --- |
| id | uuid | 主键，由 Supabase 自动生成。|
| user_id | uuid | 所属用户 ID，受 RLS 约束。|
| city | text | 冗余存储行程城市。|
| start_date | date | 行程开始日期。|
| end_date | date | 行程结束日期。|
| plan_days | jsonb | 对应 TripPlan.days。|
| weather | jsonb | 对应 TripPlan.weather_info。|
| overall_suggestions | text | 行程总结。|
| budget | jsonb | TripPlan.budget，允许为 null。|
| request | jsonb | TripRequest 原始请求，允许为 null。|
| created_at | timestamptz | 默认 `now()`。|
| updated_at | timestamptz | 可由触发器更新。|

后续若增加预算或偏好表，可在此节补充扩展表结构。

预算分析增强需新增 `expense_record` 表：

| 字段 | 类型（建议） | 说明 |
| --- | --- | --- |
| id | uuid | 主键。|
| trip_id | uuid | 对应 `trip_plan.id`，外键约束。|
| user_id | uuid | 冗余字段，便于 RLS 校验。|
| amount | numeric(12,2) | 费用金额。|
| currency | text | ISO 货币代码，缺省继承行程币种。|
| category | text | 费用类别枚举值，建议建 `check` 约束。|
| payment_method | text | 支付方式枚举值。|
| spent_at | date | 发生日期。|
| description | text | 备注，支持 Markdown。|
| source | text | 录入渠道（manual/voice）。|
| metadata | jsonb | 语音识别原始结果等附加信息。|
| created_at | timestamptz | 默认 `now()`。|
| updated_at | timestamptz | 更新时间。|

### 8.4 后端 API 接口契约

#### POST `/api/trip-request/extract`

- **请求体**：`{ "prompt": string }`
- **成功响应**：`{ "data": TripRequest }`
- **错误响应**：`{ "error": string }`
- **鉴权**：需 Supabase 登录态。

#### POST `/api/planner/generate`

- **请求体**：

  ```json
  {
    "request": TripRequest,
    "prompt": "可选的额外偏好文字"
  }
  ```

- **成功响应**：`{ "data": TripPlanRecord }`
- **错误响应**：`{ "error": string }`
- **鉴权**：需 Supabase 登录态。

#### GET `/api/itineraries`

- **成功响应**：`{ "data": TripPlanRecord[] }`
- **错误响应**：`{ "error": string }`
- **鉴权**：需登录，查询当前用户全部行程，按 `created_at` 倒序。

#### POST `/api/itineraries`

- **请求体**：`{ "plan": TripPlan, "request": TripRequest | null }`
- **成功响应**：`{ "data": TripPlanRecord }`（状态码 201）
- **错误响应**：`{ "error": string }`
- **鉴权**：需登录。

#### GET `/api/itineraries/{id}`

- **成功响应**：`{ "data": TripPlanRecord }`
- **错误响应**：`{ "error": string }`
- **鉴权**：需登录且只能访问本人记录。

#### PUT `/api/itineraries/{id}`

- **请求体**：`{ "plan": TripPlan, "request": TripRequest | null }`
- **成功响应**：`{ "data": TripPlanRecord }`
- **错误响应**：`{ "error": string }`
- **鉴权**：需登录且只能更新本人记录。

#### POST `/api/auth/callback`

- **请求体**：Supabase Auth Webhook 格式 `{ "event": string, "session": object }`
- **成功响应**：`{ "success": true }`
- **错误响应**：无（异常时返回 500）。

#### POST `/api/auth/signout`

- **请求体**：空。
- **成功响应**：`{ "ok": true }`
- **错误响应**：`{ "ok": false, "error": string }`

#### POST `/api/transcribe/iflytek`

- **请求体**：

  ```json
  {
    "audio": "base64-encoded PCM" | null,
    "pcm": "base64-encoded PCM" | null,
    "sampleRate": number,
    "business": object // 可选，覆写默认语言/领域配置
  }
  ```

- **成功响应**：

  ```json
  {
    "transcript": "完整转写文本",
    "segments": [
      { "sn": number, "ws": [{ "cw": [{ "w": string }] }], "pgs": "rpl" | null, "rg": [number, number] | null }
    ],
    "sid": "讯飞会话 ID",
    "message": "讯飞接口返回描述"
  }
  ```

- **错误响应**：`{ "error": string }`
- **鉴权**：无需登录，但需在服务端配置讯飞凭证。

#### 预算中心 API（规划中）

- **GET `/api/expenses`**：查询指定行程的费用记录，支持按日期、类别、支付方式筛选，返回 `{ "data": ExpenseRecord[] }`。
- **POST `/api/expenses`**：创建费用记录，输入 `ExpenseRecord` 除 ID/时间戳外字段，返回 `{ "data": ExpenseRecord }`。
- **PUT `/api/expenses/{id}`**：更新指定费用记录。
- **DELETE `/api/expenses/{id}`**：删除费用记录，成功返回 204。
- **GET `/api/expenses/stats`**：返回 `{ total, budgetDelta, byCategory: { amount, count, ratio }[], byDate: { date, amount }[] }`。
- **POST `/api/expenses/export`**：接受导出格式（excel/csv/report）与筛选条件，返回生成任务 ID 或直接返回文件流；Excel 导出由 SheetJS 生成多 Sheet 数据。

### 8.5 前端表单与录音载荷

- **ItineraryInputForm 表单状态**：使用 `TripRequestFormState` 保存字符串格式的输入字段，提交前转换为 TripRequest。字段包括 `city`、`start_date`、`end_date`、`travel_days`、`transportation`、`accommodation`、`preferences`、`budget_level`、`free_text_input`。
- **语音录音上传**：浏览器将 WebM 音频转换为 PCM Base64，并携带 `sampleRate` 字段上传到 `/api/transcribe/iflytek`。当选择浏览器内置识别时无服务器请求。

## 9. 竞争分析（简要）

| 产品 | 亮点 | 我们的差异 |
| --- | --- | --- |
| 马蜂窝/携程攻略 | 海量攻略内容 | 缺少 AI 个性化生成，交互复杂 |
| TripPlanner AI | 纯文字行程 | 缺语音输入、预算管理、本土地图 |
| Google Trips（已下线） | 整合 Gmail 订单 | 中国用户不可用，缺本地数据源 |

## 10. 里程碑与迭代计划

| 阶段 | 时间 | 目标 | 核心交付 |
| --- | --- | --- | --- |
| 调研与原型 | T0 - T0+4 周 | 完成用户调研、低保真原型、技术可行性验证 | 用户访谈、交互稿、技术 Spike 报告 |
| MVP 开发 | T0+5 - T0+12 周 | 支持语音创建行程、行程编辑、预算记录、登录同步 | Web MVP、基础监控、种子用户招募 |
| 内测优化 | T0+13 - T0+20 周 | 打磨体验、完善地图功能、引入实时调整 | 多方案对比、地图交互、Push 通知 |
| 正式发布 | T0+21 周+ | 上线市场推广、接入商旅资源 | 正式官网、营销页面、合作渠道 |

## 11. 风险与对策

| 风险 | 等级 | 对策 |
| --- | --- | --- |
| 语音识别准确率不足 | 高 | 与科大讯飞合作调优；提供文字补录入口 |
| LLM 成本高 | 中 | 使用缓存与提示优化；引入模型混用策略 |
| 地图数据合规 | 中 | 使用高德官方 API 并遵守备案要求 |
| 行程建议不符合本地政策 | 中 | 结合权威数据源，人工审核热门模版 |
| 用户数据安全 | 高 | 加密传输与存储，定期安全扫描 |

## 12. 未来拓展

- 支持多人协作编辑、共享行程日历。
- 引入酒店/机票预订接口，实现闭环交易。
- AI 导游模式：实时语音导览与 AR 指引。
- 离线模式与 PWA 支持。
- 与本地体验商家合作，提供优惠券与会员体系。

## 13. 资源需求

- **团队配置**：
  - 产品经理 ×1
  - 前端工程师 ×2（Next.js + 地图）
  - 后端工程师 ×1（Node.js/Supabase）
  - AI 工程师 ×1（Prompt + 模型调优）
  - UI/UX 设计师 ×1
  - QA ×1
- **预算**：云服务、语音 API、LLM API、地图服务授权费用预估每月 3-5 万元人民币。

## 14. 附录

- 术语表、API 参考链接、竞品调研报告（待补充）。
