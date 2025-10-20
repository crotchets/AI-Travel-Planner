import Link from 'next/link'

const backgroundTexture = "url('/images/home-hero-placeholder.svg')"

export default function Home() {
    return (
        <main className="relative min-h-screen overflow-hidden">
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: backgroundTexture,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center'
                }}
            />
            <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/40 to-slate-900/80" />

            <div className="relative z-10 flex min-h-screen items-center justify-center px-6 py-16">
                <section className="max-w-3xl rounded-3xl border border-white/10 bg-white/80 p-10 text-slate-900 shadow-2xl backdrop-blur">
                    <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
                        欢迎使用 AI Travel Planner
                    </h1>
                    <p className="mt-4 text-base leading-relaxed text-slate-600">
                        根据 PRD，这里是 MVP 的起点。使用导航快速进入仪表盘规划旅行，或继续完善行程、预算与设置模块。
                    </p>

                    <div className="mt-8 grid gap-3 sm:grid-cols-2">
                        {[
                            { href: '/dashboard', label: '仪表盘', tone: 'bg-blue-600' },
                            { href: '/itineraries', label: '行程', tone: 'bg-emerald-500' },
                            { href: '/budget', label: '预算', tone: 'bg-amber-500' },
                            { href: '/settings', label: '设置', tone: 'bg-slate-800' }
                        ].map(link => (
                            <Link
                                key={link.href}
                                href={link.href}
                                className={`group inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-white shadow-lg transition-transform duration-200 ease-out ${link.tone} hover:-translate-y-1 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70`}
                            >
                                <span className="transition-transform duration-200 group-hover:translate-x-0.5">
                                    {link.label}
                                </span>
                            </Link>
                        ))}
                    </div>
                </section>
            </div>
        </main>
    )
}
