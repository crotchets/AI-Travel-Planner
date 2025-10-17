import { redirect } from 'next/navigation'
import { getServerSession } from '../../lib/authServer'
import ProtectedClient from '../../components/ProtectedClient'

export default async function BudgetPage() {

    return (
        <ProtectedClient>
            <div>
                <h2 className="text-2xl font-bold mb-4">预算</h2>
                <p>预算拆分与支出记录（占位）。</p>
            </div>
        </ProtectedClient>
    )
}
