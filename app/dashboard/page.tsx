import ProtectedClient from '../../components/ProtectedClient'
import DashboardClient from '../../components/DashboardClient'

export default function DashboardPage() {
    return (
        <ProtectedClient>
            <div className="mx-auto w-full max-w-7xl px-6 py-10 lg:px-10">
                <DashboardClient />
            </div>
        </ProtectedClient>
    )
}
