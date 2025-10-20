import ProtectedClient from '../../components/ProtectedClient'
import DashboardClient from '../../components/DashboardClient'

export default function DashboardPage() {
    return (
        <ProtectedClient>
            <DashboardClient />
        </ProtectedClient>
    )
}
