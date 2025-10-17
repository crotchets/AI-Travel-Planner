import Link from 'next/link'

export default function Home() {
    return (
        <div>
            <h2 className="text-2xl font-bold mb-4">欢迎使用 AI Travel Planner</h2>
            <p className="mb-6">根据 PRD，这里是 MVP 的起点。使用左侧或顶部导航访问仪表盘、行程、预算和设置。</p>
            <div className="flex gap-3">
                <Link href="/dashboard" className="px-4 py-2 bg-blue-600 text-white rounded">仪表盘</Link>
                <Link href="/itineraries" className="px-4 py-2 bg-green-600 text-white rounded">行程</Link>
                <Link href="/budget" className="px-4 py-2 bg-yellow-500 text-white rounded">预算</Link>
                <Link href="/settings" className="px-4 py-2 bg-gray-600 text-white rounded">设置</Link>
            </div>
        </div>
    )
}
