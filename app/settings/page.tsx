import ProtectedClient from '../../components/ProtectedClient'

export default function SettingsPage() {

    return (
        <ProtectedClient>
            <div>
                <h2 className="text-2xl font-bold mb-4">设置</h2>
                <p>个人信息、偏好与同步设置（占位）。</p>
            </div>
        </ProtectedClient>
    )
}
