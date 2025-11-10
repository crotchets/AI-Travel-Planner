import ProtectedClient from '../../components/ProtectedClient'
import RuntimeConfigSettings from './RuntimeConfigSettings'

export default function SettingsPage() {
    return (
        <ProtectedClient>
            <div className="mx-auto w-full max-w-5xl px-6 py-10 space-y-8">
                <header className="space-y-2">
                    <h1 className="text-3xl font-semibold text-slate-900">设置</h1>
                    <p className="text-sm text-slate-500">
                        管理个人偏好、运行时配置与项目集成。以下敏感信息仅对当前账号可见。
                    </p>
                </header>
                <RuntimeConfigSettings />
            </div>
        </ProtectedClient>
    )
}
