# AI Travel Planner

> 🧭 AI 驱动的行程设计、预算管理与第三方服务编排一站式 Web 应用。

## 目录

- [简介](#简介)
- [产品定位与价值主张](#产品定位与价值主张)
- [目标用户画像](#目标用户画像)
- [成功指标](#成功指标)
- [功能蓝图与优先级](#功能蓝图与优先级)
- [核心功能](#核心功能)
	- [AI 行程生成](#ai-行程生成)
	- [行程管理与细节编辑](#行程管理与细节编辑)
	- [预算中心](#预算中心)
	- [运行时配置中心](#运行时配置中心)
	- [语音输入与实时转写](#语音输入与实时转写)
	- [认证与安全](#认证与安全)
- [非功能需求基线](#非功能需求基线)
- [技术栈](#技术栈)
- [架构概览](#架构概览)
- [项目结构](#项目结构)
- [常用命令](#常用命令)
- [Supabase 数据模型](#supabase-数据模型)
- [API 路由速览](#api-路由速览)
- [调试与排错提示](#调试与排错提示)
- [迭代路线图](#迭代路线图)
- [风险与对策](#风险与对策)
- [未来规划](#未来规划)

## 简介

AI Travel Planner 旨在为旅行顾问或自由行用户提供「需求收集 → 行程生成 → 行程管理 → 预算分析」的完整闭环体验。应用基于 Next.js App Router 构建，整合了阿里云百炼（Qwen）大模型、高德地图、科大讯飞语音转写以及 Supabase 全家桶，支持在浏览器侧完成语音采集、行程生成、预算跟踪与运行时配置覆写。

## 产品定位与价值主张

- **产品名称**：AI Travel Planner
- **定位**：面向自由行爱好者的智能旅行规划与辅助平台，覆盖行前规划、行中调整与行后复盘。
- **核心价值**：通过语音交互与大模型推理快速生成个性化行程，帮助用户在预算可控的前提下提升规划效率。

| 用户痛点 | 对应解决方案 |
| --- | --- |
| 旅行信息分散、调研耗时 | AI 汇总交通、住宿、景点、餐饮信息，生成结构化多日行程 |
| 预算超支不可控 | 自动拆分预算 + 实时支出统计与差额提醒 |
| 行程变更响应慢 | 云端同步 + AI 二次规划，快速调整方案 |
| 多人偏好差异大 | 支持收集偏好与备注，为不同成员生成兼顾策略 |

## 目标用户画像

- **年轻家庭（30-40 岁）**：携带孩子出行，侧重亲子友好与安全提醒。
- **情侣/夫妻**：追求高品质体验和浪漫餐饮，重视 AI 个性化推荐。
- **朋友结伴**：预算敏感，偏好高性价比玩法与夜生活推荐。
- **独行背包客**：需要灵活可调整的行程骨架与实时导航建议。

## 成功指标

- **业务指标**：MVP 内测目标 500 注册 / 日活 150+；正式上线 3 个月月活 5,000，行程生成成功率 ≥ 90%。
- **体验指标**：行程生成耗时 ≤ 15 秒；满意度 ≥ 4.2/5；语音识别准确率 ≥ 90%。
- **运营指标**：日均行程保存 ≥ 300；预算记录触达率 ≥ 60%。

## 功能蓝图与优先级

### 模块总览

| 模块 | 描述 | 当前状态 |
| --- | --- | --- |
| 行程规划 | 语音/文字收集需求，AI 生成多日行程并可编辑保存 | ✅ MVP 已实现 |
| 预算管理 | 预算拆分、支出记录、语音记账、统计导出 | ✅ MVP 已实现 |
| 用户账户 | 登录注册、偏好保存、行程与配置同步 | ✅ 已实现 |
| 实时辅助 | 行程提醒、动态调整、地图导航 | 🚧 规划中 |
| 管理后台 | 模板与数据分析工具 | 🗺️ 后续版本 |

### 用户故事（节选）

| 编号 | 用户故事 | 优先级 | 当前支持 |
| --- | --- | --- | --- |
| US1 | 语音描述旅行需求即可生成行程 | P0 | ✅ 浏览器语音 + 讯飞 IAT + 百炼生成 |
| US2 | 编辑行程某天并快速调整 | P0 | ✅ 详情弹窗表单化编辑 |
| US3 | 保存行程并跨设备查看 | P0 | ✅ Supabase Auth + 数据持久化 |
| US4 | 记录每日花销并获取分析 | P1 | ✅ 预算中心费用表单与图表 |
| US5 | 在地图上查看景点与导航 | P1 | ✅ 高德地图标注（导航跳转规划中） |
| US6 | 分享行程给同行者 | P2 | 🚧 分享导出功能待实现 |

## 快速上手

### 先决条件

- Node.js **20.x**（参考项目根目录的 `.nvmrc`）
- 一个已启用邮件或第三方登录的 **Supabase** 项目
- 可用的百炼 DashScope API Key、高德地图 JS SDK Key、讯飞实时听写 (IAT) 凭据

### 本地开发

1. 克隆仓库并进入目录：

	```powershell
	git clone https://github.com/crotchets/AI-Travel-Planner.git
	cd AI-Travel-Planner
	```

2. 复制环境变量模板并填写实际值：

	```powershell
	copy .env.example .env.local
	```

3. 安装依赖并启动开发服务器：

	```powershell
	npm install
	npm run dev
	```

4. 打开浏览器访问 [http://localhost:3000](http://localhost:3000)。首次访问需先通过 Supabase 登录页完成认证。

## 环境变量

将以下变量写入 `.env.local`。Supabase 相关配置由服务器端直接读取，其余公开变量可在前端访问，并可在设置页通过「运行时配置」进行用户级覆写。

| 变量名 | 必填 | 说明 |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ | Supabase Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ | Supabase 匿名访问密钥 |
| `NEXT_PUBLIC_AMAP_API_KEY` | ✅ | 高德地图 Web JS SDK Key，用于地图渲染 |
| `NEXT_PUBLIC_AMAP_SECURITY_CODE` | ⭕️ | 若启用安全密钥校验需填写 |
| `NEXT_PUBLIC_IFLYTEK_IAT_APP_ID` | ✅ | 讯飞实时听写应用 ID |
| `NEXT_PUBLIC_IFLYTEK_IAT_API_KEY` | ✅ | 讯飞实时听写 API Key |
| `NEXT_PUBLIC_IFLYTEK_IAT_API_SECRET` | ✅ | 讯飞实时听写 API Secret |
| `NEXT_PUBLIC_IFLYTEK_IAT_URL` | ⭕️ | IAT WebSocket 自定义入口，留空使用默认 |
| `NEXT_PUBLIC_IFLYTEK_IAT_SAMPLE_RATE` | ⭕️ | 采样率设置（默认 16000） |
| `NEXT_PUBLIC_IFLYTEK_IAT_CHUNK_BYTES` | ⭕️ | WebSocket 单帧最大字节数 |
| `NEXT_PUBLIC_IFLYTEK_IAT_MAX_BYTES` | ⭕️ | 会话最大字节限制 |
| `NEXT_PUBLIC_IFLYTEK_IAT_LANGUAGE`/`ACCENT`/`DOMAIN`/`DWA` | ⭕️ | 讯飞 IAT 语言、方言、业务域、动态修正配置 |
| `NEXT_PUBLIC_BAILIAN_API_KEY` | ✅ | 百炼 DashScope API Key |
| `NEXT_PUBLIC_BAILIAN_API_BASE_URL` | ⭕️ | 百炼兼容模式自定义网关（默认为官方地址） |
| `NEXT_PUBLIC_BAILIAN_DEFAULT_MODEL` | ⭕️ | 通用模型名称（默认 `qwen-plus`） |
| `NEXT_PUBLIC_BAILIAN_TRIP_REQUEST_MODEL` | ⭕️ | TripRequest 抽取模型 |
| `NEXT_PUBLIC_BAILIAN_TRIP_PLAN_MODEL` | ⭕️ | TripPlan 生成模型 |
| `NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS` | ⭕️ | 百炼请求超时（毫秒，默认 120000） |

## 核心功能

### AI 行程生成

- `components/ItineraryInputForm.tsx` 支持文本输入与双通道语音输入（浏览器原生识别 & 讯飞 IAT）。
- `/api/trip-request/extract` 使用百炼模型抽取结构化 TripRequest，校验后交由 `/api/planner/generate` 生成完整 TripPlan，并写入 Supabase `trip_plan` 表。
- 对话式提示、行程概览与天气预报在 Dashboard 中即时呈现。

### 行程管理与细节编辑

- `components/ItinerariesClient.tsx` 提供按目的地、日期区间、创建时间排序的行程列表。
- `components/ItineraryDetailDialog.tsx` 在详情模态内完成行程复制、基础信息、每日交通住宿及预算分项的表单化编辑，无需再直接修改 JSON。
- 地图视图通过 `ItineraryMap` 接入高德地图，可在运行时切换 API Key。

### 预算中心

- `components/BudgetClient.tsx` 绑定选中行程，支持费用录入、语音识别、筛选、批量导出（Excel/CSV/HTML）。
- `/api/expenses`、`/api/expenses/[id]`、`/api/expenses/stats` 实现支出 CRUD 与统计聚合，`/api/expenses/analysis` 调用百炼生成消耗总结与行动建议。
- 图表由 Recharts 驱动，SheetJS (xlsx) 提供导出能力。

### 运行时配置中心

- `app/settings/RuntimeConfigSettings.tsx` 提供可视化表单以覆盖非 Supabase 的第三方 API Key。
- `lib/runtimeConfig.ts` 将环境默认值与用户覆写持久化到 `user_runtime_config` 表，并在客户端读取合并后的有效配置。
- AMap、讯飞及百炼调用自动读取有效配置，适用于多租户或多环境场景。

### 语音输入与实时转写

- `/app/api/transcribe/iflytek/route.ts` 通过 WebSocket 与讯飞 IAT 交互，逐帧推送本地转码的 16k PCM 音频。
- 客户端利用 Web Audio API 对录音数据降采样、分帧和 Base64 转码，兼容不同浏览器。

### 认证与安全

- 基于 `@supabase/auth-helpers-nextjs` 实现的边缘无感登录态同步，`AuthProvider` 负责客户端会话缓存。
- `components/SignOutButton.tsx` 支持 Supabase 全局登出，保证多端 session 一致。
- 所有 API Route 在访问数据库前会校验用户身份，未授权请求统一返回 401。

## 非功能需求基线

- **性能**：核心 API 目标平均响应 < 1.5 秒（LLM 调用除外），关键表单交互保持 60fps。
- **可靠性**：Supabase 与第三方服务目标 99.5% 可用性，行程与费用数据每日备份。
- **安全合规**：敏感信息加密传输与存储，遵循 GDPR/本地隐私规范，计划提供数据导出与删除能力。
- **可扩展性**：Serverless 组件化设计，LLM 供应商与地图服务可配置，支持后续微服务拆分。
- **可访问性**：遵循 WCAG 2.1 AA，支持键盘导航与语音辅助交互。

## 技术栈

- **Framework**：Next.js App Router、React 18、TypeScript
- **UI**：Tailwind CSS、Headless UI、Radial design tokens（自定义）
- **数据层**：Supabase Postgres + Row Level Security
- **AI 能力**：阿里云百炼（Qwen 系列模型）
- **地图与语音**：高德地图 JavaScript API、科大讯飞实时听写
- **可视化 & 工具**：Recharts、SheetJS、TanStack Query、Zustand

## 架构概览

```
┌──────────────┐        ┌─────────────────┐
│ Next.js App  │  HTTPS │ Supabase REST &  │
│ (app router) │ ─────► │ Edge Functions   │
└─────▲────────┘        └────────┬────────┘
		│ 前端 fetch                           │ Row Level Security
		│                                      ▼
		│                         ┌──────────────────────┐
		│                         │ Postgres (trip_plan, │
		│                         │ expense_record,      │
		│                         │ user_runtime_config) │
		│                         └────────┬────────────┘
		│                                      │
		│OAuth/Token                           │Webhooks (可选)
		▼                                      ▼
┌──────────────┐        ┌─────────────────┐
│ 讯飞 IAT WS  │        │ 百炼 DashScope  │
└──────────────┘        └─────────────────┘
```

## 项目结构

| 目录 | 说明 |
| --- | --- |
| `app/` | Next.js App Router 页面与 API Routes（含 auth、itineraries、expenses 等） |
| `components/` | 可复用前端组件（ItineraryInputForm、BudgetClient、ItineraryDetailDialog 等） |
| `lib/` | 数据访问、第三方服务封装（Supabase、DashScope、runtime config、mapper） |
| `types/` | TypeScript 类型定义（行程、预算、配置等） |
| `docs/` | 产品需求文档（`PRD.md`）及补充资料 |
| `public/` | 静态资源 |

## 常用命令

```powershell
npm run dev     # 本地开发（默认 http://localhost:3000）
npm run build   # 生产构建
npm run start   # 生产模式运行（需先构建）
npm run lint    # ESLint 检查
```

## Supabase 数据模型

- **`trip_plan`**：存储生成后的行程主数据（城市、日期、每日计划、预算、天气、TripRequest）。
- **`expense_record`**：与行程绑定的费用记录，记录金额、币种、类别、支付方式、发生时间及来源。
- **`user_runtime_config`**：存储用户级第三方 API Key 覆写，支持在设置页读取与更新。

> 建议参考 `docs/PRD.md` 中的数据表设计，确保已在 Supabase 中创建相应表结构与 RLS 策略。

## API 路由速览

| 路径 | 方法 | 说明 |
| --- | --- | --- |
| `/api/trip-request/extract` | POST | 从自然语言抽取结构化 TripRequest |
| `/api/planner/generate` | POST | 调用百炼生成 TripPlan 并落库 |
| `/api/itineraries` | GET/POST | 行程列表查询与手动创建 |
| `/api/itineraries/[id]` | GET/PUT/DELETE | 行程详情、更新与删除 |
| `/api/expenses` | GET/POST | 按行程维度的费用查询/新增 |
| `/api/expenses/[id]` | PATCH/DELETE | 费用更新与删除 |
| `/api/expenses/stats` | GET | 费用统计聚合 |
| `/api/expenses/analysis` | POST | 调用百炼生成预算分析报告 |
| `/api/transcribe/iflytek` | POST | 代理讯飞 IAT 转写 WebSocket |
| `/api/settings/config` | GET/PUT | 运行时配置的读取与保存 |

## 调试与排错提示

- **语音录入异常**：确认浏览器已授予麦克风权限，并校验 `NEXT_PUBLIC_IFLYTEK_*` 配置是否正确。可在浏览器控制台查看 WebSocket 连接日志。
- **地图无法加载**：检查高德 Key 与安全密钥是否匹配，或在设置页覆盖新的 Key。
- **百炼请求报错**：默认超时 120 秒，可结合 `NEXT_PUBLIC_BAILIAN_REQUEST_TIMEOUT_MS` 调整；必要时在服务器日志中查看 DashScope 响应。
- **未登录提示**：Supabase Session 失效时会跳转到 `/auth`，可在 Supabase 控制台启用 Email OTP 或第三方认证。

## 迭代路线图

| 阶段 | 时间窗口 | 目标 | 核心交付 |
| --- | --- | --- | --- |
| 调研与原型 | T0 - T0+4 周 | 完成用户调研、低保真原型与技术可行性验证 | 用户访谈、交互稿、技术 Spike 报告 |
| MVP 开发 | T0+5 - T0+12 周 | 支持语音行程、行程编辑、预算记录、登录同步 | Web MVP、基础监控、种子用户招募 |
| 内测优化 | T0+13 - T0+20 周 | 打磨体验、完善地图功能、引入实时调整 | 多方案对比、地图交互、Push 通知 |
| 正式发布 | T0+21 周起 | 上线推广、接入商旅资源 | 正式官网、营销页面、合作渠道 |

## 风险与对策

| 风险 | 等级 | 应对策略 |
| --- | --- | --- |
| 语音识别准确率不足 | 高 | 与科大讯飞联合调优，提供文字补录兜底流程 |
| LLM 调用成本高 | 中 | 启用缓存、提示词优化与多模型混用策略 |
| 地图数据合规要求 | 中 | 使用官方授权 API，配合备案合规审核 |
| 行程建议触碰政策红线 | 中 | 引入权威数据源，热门模板人工抽检 |
| 用户数据安全风险 | 高 | 加密存储与定期安全扫描，完善访问控制 |

## 未来规划

- 支持多人协作与行程共享日历，帮助家庭/团体实时协同。
- 引入机酒/本地体验预订接口，形成规划到交易的闭环。
- 推出 AI 导游模式，结合语音播报与 AR 导览增强行中体验。
- 提供离线模式与 PWA 支持，保障弱网环境可用性。
- 与本地服务商建立合作，打通会员体系与优惠券发放。

---

如需了解更完整的产品规划与交互细节，请参考 `docs/PRD.md`。
