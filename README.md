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
IFLYTEK_IAT_APP_ID=your_iflytek_iat_app_id
IFLYTEK_IAT_API_KEY=your_iflytek_iat_api_key
IFLYTEK_IAT_API_SECRET=your_iflytek_iat_api_secret
# （可选）兼容旧 REST 调用的变量
IFLYTEK_APP_ID=your_legacy_iflytek_app_id
IFLYTEK_API_SECRET=your_legacy_iflytek_api_secret
```

主要目录：

- app/ — Next.js App Router 页面
- components/ — 可复用 UI 组件
- lib/ — Supabase 客户端等

亮点能力：

- `components/ItineraryInputForm.tsx` 支持浏览器原生语音识别与科大讯飞语音转写双模式切换，并在本地将录音流转码为 16k PCM 后再上传。
- `app/api/transcribe/iflytek/route.ts` 基于 websocket 调用讯飞实时听写（IAT）服务，按帧推送音频并聚合返回的实时转写结果。
