# AI Travel Planner — Web MVP

这是根据 PRD 创建的 Next.js 15 + TypeScript + Tailwind + Supabase 最小骨架。

快速开始（PowerShell）：

```powershell
npm install
npm run dev
```

环境变量（复制为 .env.local）：

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
IFLYTEK_APP_ID=your_iflytek_app_id
IFLYTEK_API_SECRET=your_iflytek_api_secret
```

主要目录：

- app/ — Next.js App Router 页面
- components/ — 可复用 UI 组件
- lib/ — Supabase 客户端等

亮点能力：

- `components/ItineraryInputForm.tsx` 支持浏览器原生语音识别与科大讯飞语音转写双模式切换，后者需在 `.env.local` 中配置讯飞 API 凭证。
- `app/api/transcribe/iflytek/route.ts` 封装讯飞语音转写调用流程（prepare → upload → merge → progress → result），并返回整理后的文本结果。
