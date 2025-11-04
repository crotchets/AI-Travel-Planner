import ProtectedClient from '../../components/ProtectedClient'

export default function ItinerariesPage() {

    return (
        <ProtectedClient>
            <div className="mx-auto w-full max-w-5xl px-6 py-10">
                <h2 className="mb-4 text-2xl font-bold">行程</h2>
                <p>行程列表与创建入口（占位）。</p>
            </div>
        </ProtectedClient>
    )
}
