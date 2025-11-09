# 参考实现：HelloAgents 文档对纯前端方案的启发

> 来源：Datawhale《Hello Agents》项目第十三章文档与配套仓库 [`helloagents-trip-planner`](https://github.com/datawhalechina/hello-agents/tree/main/code/chapter13/helloagents-trip-planner)。以下内容提炼可迁移到 **Next.js 15 + TypeScript + Tailwind + Supabase + LLM API** 的纯前端架构，并结合我们现有 PRD 做微调。

## 一、行程数据契约（前端 <-> LLM API / Supabase）

### 1. LLM 行程规划请求体 `TripRequest`

字段 | 说明 | 采集方式
:---|:---|:---
`city` | 必填，目的地城市 | 表单选择（支持热门 / 搜索）
`start_date` / `end_date` | 旅行起止日期（`YYYY-MM-DD`） | 日期区间选择器
`travel_days` | 行程天数（1-30，冗余字段，可由日期自动计算） | 自动推导并允许覆盖
`transportation` | 偏好交通方式（公共交通、自驾、步行等） | 单选按钮组
`accommodation` | 住宿偏好（经济、精品、亲子、豪华等） | 单选 + 可选补充
`preferences` | 旅行风格标签数组（历史文化 / 美食 / 自然 / 夜生活 ...） | 多选标签
`budget_level` | 预算等级（经济 / 适中 / 奢华） | 单选，可在前端提示影响餐饮/酒店选择
`free_text_input` | 自由描述（特殊需求、同行人信息、节奏偏好） | 多行文本框

> Next.js 端直接以 TypeScript 接口定义，与调用 LLM 的 `fetch`/`supabase.functions.invoke` 保持一致。前端验证后发送至 LLM API，Supabase Edge Function 只做转发/注入工具调用结果。

### 2. LLM 响应体 `TripPlan`

字段 | 说明 | 存储策略
:---|:---|:---
`city`、`start_date`、`end_date` | 基本信息 | Supabase `trip_plan` 表冗余字段
`days: DayPlan[]` | 按天拆分的行程列表 | JSONB 列 `plan_days`
`weather_info: WeatherInfo[]` | 每日天气摘要（温度为数字） | JSONB 列 `weather`
`overall_suggestions` | 行程总览建议 | TEXT
`budget?: Budget` | 按类别统计费用（交通/餐饮/酒店/景点） | JSONB 列 `budget`

#### `DayPlan`

字段 | 说明
:---|:---
`date` / `day_index` | 对应日期与序号
`description` | 当日亮点摘要
`transportation` / `accommodation` | 当日交通、住宿安排说明
`hotel?` | 推荐酒店（名称、地址、评分、价格区间、经纬度）
`attractions: Attraction[]` | 景点数组（名称、描述、分类、经纬度、建议时长、票价、评分、图片 URL）
`meals: Meal[]` | 三餐安排（名称、类型、餐标估算、推荐菜品）

#### Supabase 表示例

表名 | 字段 | 说明
:---|:---|:---
`trip_plan` | `id uuid` | 主键
 | `user_id uuid` | Supabase Auth 用户 ID
 | `request jsonb` | 保存原始 `TripRequest`
 | `plan_days jsonb` | `DayPlan[]`
 | `weather jsonb` | `WeatherInfo[]`
 | `overall_suggestions text` | 总览
 | `budget jsonb` | `Budget`
 | `created_at timestamptz` | 创建时间

> 前端拉取历史行程时只需查询当前用户的 `trip_plan`，并在客户端解构 JSON 渲染。

## 二、与 LLM API 的交互要点

1. **调用入口**：Next.js `app/api/plan/route.ts` 或 Supabase Edge Function（推荐 Edge Function 以隐藏密钥并复用 Supabase SDK）。
2. **提示词结构**：沿用 HelloAgents 的角色拆分思路，但在前端/Edge Function 内一并组织成单轮提示：
    - 先在 Edge Function 里发起工具调用（见下一节），将景点 / 天气 / 酒店结果拼接为上下文。
    - 构造系统提示明确返回严格 JSON，并提供 `TripPlan` schema 示例。
    - 发送用户提示（携带请求体、工具数据、额外说明）。
3. **错误兜底**：若模型返回文本无法解析，回退到本地模板（日历+随机景点占位），避免前端崩溃。
4. **流式渲染**：可选择 SSE / Response Streaming；若暂不支持，保留 loading skeleton 与进度提示。

### 推荐的系统提示骨架

```text
你是一名旅行行程规划师，需要输出严格的 JSON。字段定义如下：...
必须遵守：
1. `weather_info[].temperature` 为数字。
2. `days` 每日含 2-3 个 `attractions`，并提供 `meals`、`transportation`、`accommodation`。
3. `budget.total = sum(category.amount)`。

以下是外部工具给出的信息：
- 景点检索结果：...
- 酒店推荐：...
- 天气：...
```

> 将该提示作为 Edge Function 内的常量模板，并根据用户输入动态插入偏好描述与工具结果。

## 三、MCP 与工具调用在前端架构中的定位

- **开发阶段**：在 VS Code 中通过 `amap-mcp-server` 辅助人工探索 POI/天气，确认 prompt 模板。
- **运行阶段**：Edge Function 充当“工具调用器”。使用 Supabase 的 `fetch` 内置 `createClient`，在服务端调用高德地图 REST API（或通过自建代理）获取数据，并缓存到 Supabase KV / Postgres 表。
- **必备功能**：
  1. `maps_text_search` → 景点/餐饮/酒店关键词搜索。
  2. `maps_weather` → 获取 3-7 天城市天气。
  3. `maps_search_detail` → 需要补充经纬度/营业时间时调用。
- **可选扩展**：距离测量、交通路线。将来若要实现“路线规划”标签，可在 Edge Function 内调用对应 API，将结果交给 LLM 参考或直接返回给前端渲染。

## 四、React 版地图呈现（替代 Vue 实现）

1. **依赖引入**：使用 `@amap/amap-jsapi-loader` 动态加载 SDK，建议封装 `useAmapLoader` Hook，处理 API Key 读取与实例缓存。
2. **组件初始化**：在 `MapPreview` 内通过 `useEffect` 创建 `AMap.Map`：

    ```ts
    useEffect(() => {
      if (!containerRef.current || !window.AMap) return;
      const map = new AMap.Map(containerRef.current, {
        zoom: 12,
        center: [centerLng, centerLat],
        viewMode: '3D'
      });
      mapRef.current = map;
      return () => map.destroy();
    }, [centerLng, centerLat]);
    ```

3. **标记与信息窗**：遍历 `plan.days`，生成 Marker，并用 `marker.setLabel({ content: index + 1 })`；点击时通过 `AMap.InfoWindow` 展示富文本。
4. **路线连线**：按 `day_index` 分组景点，利用 `AMap.Polyline` 绘制路径，颜色可使用 Tailwind 配色（如 `#22d3ee`）。
5. **自适应视野**：收集所有 Marker 调用 `map.setFitView(markers)`。
6. **导出 & 分享**：
   - 通过 `html2canvas` 捕获地图容器并生成 PNG，用于分享卡片。
   - 生成 PDF 可结合 `jsPDF`。注意在导出前将 AMap 底层 Canvas 转换为图片避免跨域报错。
7. **编辑联动**：当用户调整景点顺序时，先更新本地 state，再调用 `map.destroy()` 重建，确保 Marker/Polyline 对齐。
8. **图片占位**：沿用 SVG 渐变占位方案，保证卡片在无图时仍然美观。

## 五、前端状态管理与 Supabase 同步

1. **状态流**：
   - 表单状态：`useReducer` 或 `react-hook-form` 管理，提交时生成 `TripRequest`。
   - 生成中：维护 `status`（`idle` | `planning` | `success` | `error`），并显示阶段提示（景点检索/天气/酒店/生成行程）。
   - 结果缓存：成功后写入 `useTripStore`（Zustand 或 Context）。
2. **写入 Supabase**：调用 `supabase.from('trip_plan').insert({ ... })`，并使用 RLS 保障用户隔离。
3. **读取历史**：页面加载时 `supabase.from('trip_plan').select('*').order('created_at', { ascending: false })`，并在客户端解析 JSONB。
4. **离线备份**：同时将最新行程写入 `localStorage`，即使请求失败也能恢复上一次结果。

## 六、可借鉴的交互细节

- **分阶段进度条**：前端设定模拟进度（示例：0-40% 搜索景点、40-60% 查询天气、60-80% 推荐酒店、80-100% 生成行程），结合 loading 提示文案。
- **行程编辑模式**：进入编辑前深拷贝 `TripPlan`，提供拖拽排序（`@dnd-kit`）与删除操作。取消时还原备份，保存时重新写入 Supabase。
- **导出分享**：提供 PNG/PDF 导出，同时生成社交分享摘要（行程天数、预算、Top 景点）。
- **章节导航**：通过侧边目录/锚点跳转到“概览/预算/地图/每日/天气”，提升长页面可读性。

## 七、与本仓库的结合建议

1. **类型定义**：在 `types/trip.ts`（待创建）中编写 `TripRequest`、`TripPlan`、`DayPlan` 等接口，并导出供表单与渲染组件复用。
2. **Edge Function 模板**：创建 `supabase/functions/plan/index.ts`，集成高德 API 请求、LLM 调用与 JSON 校验（可用 `zod` 保证结构正确）。
3. **地图组件增强**：在现有 `MapPreview` 中加入 Polyline/InfoWindow 与导出按钮，复刻 HelloAgents 的易用体验。
4. **MCP 工作流文档**：补充 `.vscode/mcp.json` 的使用说明，帮助开发者在本地通过 MCP 测试高德工具调用。
5. **回写文档**：实现新功能后及时更新本文件，保持架构与实现同步。

> 以上梳理将 HelloAgents 的最佳实践转换为我们当前纯前端 + Supabase + LLM 的交付模型，可作为行程规划功能迭代时的常用参考。*** End Patch
