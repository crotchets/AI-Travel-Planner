import ProtectedClient from '../../components/ProtectedClient'

export default function BudgetPage() {

    return (
        <ProtectedClient>
            <div className="mx-auto w-full max-w-5xl px-6 py-10">
                <h2 className="mb-4 text-2xl font-bold">预算</h2>
                <p>预算拆分与支出记录（占位）。</p>
            </div>
        </ProtectedClient>
    )
}
