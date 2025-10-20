import ProtectedClient from '../../components/ProtectedClient'

export default function ItinerariesPage() {

    return (
        <ProtectedClient>
            <div>
                <h2 className="text-2xl font-bold mb-4">行程</h2>
                <p>行程列表与创建入口（占位）。</p>
            </div>
        </ProtectedClient>
    )
}
