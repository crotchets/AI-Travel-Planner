import ProtectedClient from '../../components/ProtectedClient'
import ItinerariesClient from '../../components/ItinerariesClient'

export default function ItinerariesPage() {
    return (
        <ProtectedClient>
            <div className="mx-auto w-full max-w-6xl px-6 py-10 lg:px-10">
                <ItinerariesClient />
            </div>
        </ProtectedClient>
    )
}
