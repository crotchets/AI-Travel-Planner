# 已完成功能模块概览（截至 2025-11-04）

> 本文梳理当前代码库中已落地的能力，并按模块快速定位实现位置、关键交付物与后续留白。

## 基础架构

- ✅ **技术栈落地**：整合 Next.js 15 App Router、TypeScript、Tailwind CSS 与 Supabase；项目已按约定格式组织 `app/`、`components/`、`docs/` 等目录。
- ✅ **工具链与规范**：配置 ESLint、Tailwind 插件、`@typescript-eslint` 规则；提供 `npm run lint` 校验。
- 📁 **关键文件**：
  - `app/layout.tsx` — 全局布局、Meta 配置。
  - `components/RootClient.tsx` — 封装 AuthProvider、导航与通用布局。
  - `docs/PRD.md` — 产品需求与迭代规划。
- 🔜 **扩展方向**：补充 CI/CD 流水线、端到端测试基线、性能监控。

## 用户认证与权限

- ✅ **登录态管理**：通过 Supabase Auth 完成邮箱登录注册；`AuthProvider` 负责 Session 同步。
- ✅ **受保护路由**：`ProtectedClient` 处理未登录重定向；仪表盘、预算、行程、设置页面均已接入。
- 📁 **关键文件**：
  - `components/AuthProvider.tsx`
  - `components/ProtectedClient.tsx`
  - `app/auth/page.tsx`
- 🔜 **扩展方向**：补充多因素认证、第三方登录、错误提示与 loading skeleton。

## 语音转写接口

- ✅ **科大讯飞 IAT**：实现 `/api/transcribe/iflytek` Serverless Endpoint，支持 16k PCM 流上传、WebSocket 转写回传。
- ✅ **错误处理**：对接鉴权、心跳、超时等异常分支，记录日志方便观察。
- 📁 **关键文件**：
  - `app/api/transcribe/iflytek/route.ts`
  - `lib/iflytek/client.ts`（如果存在）
- 🔜 **扩展方向**：提供本地 Mock、回放录音、接入行程自动生成流程。

## 仪表盘体验（Dashboard）

- ✅ **布局与分栏**：`DashboardClient` 引入拖拽可调的内容/地图比例，兼容键盘无障碍操作。
- ✅ **行程需求表单占位**：`ItineraryInputForm`（占位）传递结构化 payload，为接入 LLM 行程生成预留接口。
- ✅ **地图预览**：侧边嵌入高德地图示意，按环境变量加载真实 Key。
- 📁 **关键文件**：
  - `components/DashboardClient.tsx`
  - `components/ItineraryInputForm.tsx`
  - `components/MapPreview.tsx`
- 🔜 **扩展方向**：打通行程生成 API、展示历史行程列表、提供地图标注交互。

## 地图组件（MapPreview）

- ✅ **官方 Loader 接入**：使用 `@amap/amap-jsapi-loader`，封装 Key/Security Code 处理与控件加载。
- ✅ **资源释放**：组件卸载时销毁实例，避免内存泄漏；支持外部传入中心点与缩放。
- 📁 **关键文件**：`components/MapPreview.tsx`
- 🔜 **扩展方向**：标注行程点、路径绘制、主题切换与错误 UI。

## 首页与导航

- ✅ **Hero & 快速入口**：`app/page.tsx` 覆盖全宽渐变背景、CTA 按钮、三张快速入口卡片。
- ✅ **导航统一**：`components/Nav.tsx` 调整排版与 hover 视觉；`RootClient` 实现透明背景头部。
- ✅ **邮箱输入校验**：`components/AuthForm.tsx` 添加正则验证与错误提示。
- 📁 **关键文件**：
  - `app/page.tsx`
  - `components/Nav.tsx`
  - `components/AuthForm.tsx`
- 🔜 **扩展方向**：动态展示最近行程、A/B Hero 文案、移动端导航抽屉。

## 文档与协作指南

- ✅ **PRD**：`docs/PRD.md` 记录产品概述、模块需求、进度与未来规划。
- ✅ **Copilot 指南**：`.github/copilot-instructions.md` 约束自动化开发流程。
- ✅ **环境说明**：`.env.example`（如存在）提供必要变量说明。
- 🔜 **扩展方向**：补充贡献指南、API 文档、设计稿链接。

---

> 若有新功能落地，请同步更新本文件，并在 PRD 的“当前进度”表中追加对应状态。
