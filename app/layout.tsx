import './globals.css'
import RootClient from '../components/RootClient'

export const metadata = {
    title: 'AI Travel Planner',
    description: '智能旅行规划平台 (MVP)'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
    return (
        <html lang="zh-CN">
            <body>
                <RootClient>{children}</RootClient>
                <footer className="bg-white border-t">
                    <div className="container mx-auto px-4 py-4 text-sm text-gray-600">© 2025 AI Travel Planner</div>
                </footer>
            </body>
        </html>
    )
}
