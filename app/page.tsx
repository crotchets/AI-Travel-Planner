import Link from 'next/link'

const quickLinks = [
    {
        title: '快速规划',
        description: '输入目的地与偏好，几秒钟生成 AI 行程规划草案。',
        href: '/dashboard'
    },
    {
        title: '查看费用',
        description: '实时掌握预算支出，对比计划与实际，做出更聪明的选择。',
        href: '/budget'
    },
    {
        title: '查看行程',
        description: '随时查看已生成的路线与安排，快速调整每日任务与停留。',
        href: '/itineraries'
    }
]

export default function Home() {
    return (
        <main className="relative min-h-screen overflow-hidden bg-gradient-to-b from-indigo-50 via-white to-indigo-100 text-slate-900">
            <div className="pointer-events-none absolute inset-x-0 -top-40 h-[460px] bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.22),transparent_70%)]" />
            <div className="pointer-events-none absolute inset-x-0 top-16 hidden h-96 bg-[radial-gradient(circle_at_top_right,rgba(129,140,248,0.16),transparent_70%)] blur-3xl md:block" />

            <div className="relative flex min-h-screen w-full flex-col gap-16 px-6 py-16 sm:px-10 lg:px-16 lg:py-24">
                <section className="relative mx-auto w-full max-w-6xl overflow-hidden rounded-[36px] bg-white/90 p-10 text-center shadow-xl shadow-indigo-200/50 backdrop-blur-lg md:p-16">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(129,140,248,0.18),transparent_75%)]" />
                    <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-6">
                        <span className="inline-flex items-center rounded-full bg-indigo-50 px-4 py-1 text-xs font-semibold tracking-[0.35em] text-indigo-500">
                            智能旅行助手 · 云端同步
                        </span>
                        <h1 className="text-4xl font-bold leading-tight tracking-tight text-slate-900 sm:text-5xl">
                            一次对话，搞定你的下一次旅行
                        </h1>
                        <p className="text-base leading-relaxed text-slate-500 sm:text-lg">
                            通过 AI 自动生成行程，掌握预算收支，语音随时更新旅行计划，让每一次出行都轻松有序。
                        </p>
                        <div className="flex flex-col gap-3 sm:flex-row">
                            <Link
                                href="/dashboard"
                                className="inline-flex items-center justify-center rounded-full bg-indigo-500 px-7 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/40 transition hover:bg-indigo-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
                            >
                                立即开始规划
                            </Link>
                            <Link
                                href="/itineraries"
                                className="inline-flex items-center justify-center rounded-full border border-indigo-100 px-7 py-3 text-sm font-semibold text-indigo-500 transition hover:border-indigo-300 hover:bg-indigo-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
                            >
                                查看我的行程
                            </Link>
                        </div>
                    </div>
                </section>

                <section className="mb-10 flex flex-col gap-6">
                    <header className="flex flex-col gap-2 text-center">
                        <h2 className="text-2xl font-semibold text-slate-900">快速入口</h2>
                        <p className="mx-auto max-w-2xl text-sm text-slate-500">
                            覆盖规划、预算与行程管理核心功能，快速抵达你常用的操作模块。
                        </p>
                    </header>

                    <div className="mx-auto grid w-full max-w-6xl gap-5 md:grid-cols-3">
                        {quickLinks.map(link => (
                            <Link
                                key={link.title}
                                href={link.href}
                                className="group relative flex h-full flex-col gap-4 rounded-2xl border border-indigo-100 bg-white/90 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-indigo-200 hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-300"
                            >
                                <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white">
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="currentColor"
                                        className="h-5 w-5"
                                    >
                                        <path d="M12 2a1 1 0 0 1 .894.553l2 4A1 1 0 0 1 14 8h-4a1 1 0 0 1-.894-1.447l2-4A1 1 0 0 1 12 2ZM9 10a1 1 0 0 1 1 1v9a1 1 0 0 1-2 0v-9a1 1 0 0 1 1-1Zm5 0a1 1 0 0 1 1 1v9a1 1 0 0 1-2 0v-9a1 1 0 0 1 1-1Zm-9 3a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1Zm14 0a1 1 0 0 1 1 1v6a1 1 0 0 1-2 0v-6a1 1 0 0 1 1-1Z" />
                                    </svg>
                                </div>
                                <div className="space-y-2">
                                    <h3 className="text-lg font-semibold text-slate-900">{link.title}</h3>
                                    <p className="text-sm leading-relaxed text-slate-500">{link.description}</p>
                                </div>
                                <span className="mt-auto inline-flex items-center text-sm font-medium text-indigo-500 transition group-hover:translate-x-1">
                                    立即前往
                                    <svg
                                        xmlns="http://www.w3.org/2000/svg"
                                        viewBox="0 0 24 24"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="1.5"
                                        className="ml-1 h-4 w-4"
                                    >
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                                    </svg>
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    )
}
