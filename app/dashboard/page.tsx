import { redirect } from 'next/navigation'
import { getServerSession } from '../../lib/authServer'
import ProtectedClient from '../../components/ProtectedClient'
import DashboardClient from '../../components/DashboardClient'

export default async function DashboardPage() {


    return (
        <ProtectedClient>
            <DashboardClient />
        </ProtectedClient>
    )
}
