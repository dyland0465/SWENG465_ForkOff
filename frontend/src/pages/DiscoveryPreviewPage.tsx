import { useEffect, useState } from 'react'
import { generatePath, useParams } from 'react-router'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import './DiscoveryPreviewPage.css'

type Restaurant = {
  id: string
  name: string
  address: string | null
  category: string | null
  googleMapsUri: string | null

}

type RestaurantResponse = {
  lobbyId: string
  attribution: string
  count: number
  restaurants: Restaurant[]
}

function DiscoveryPreviewScreen({ lobbyId }: { lobbyId: string }) {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()

    async function loadRestaurants() {
      setLoading(true)
      setError('')
      setRestaurants([])

      try {
        const response = await fetch(
          `/api/lobbies/${encodeURIComponent(lobbyId)}/restaurants`,
          {
            signal: controller.signal,
            credentials: 'same-origin',
          },
        )

        if (!response.ok) {
          const result = await response.json().catch(() => ({}))
          throw new Error(
            result.message || 'Could not load restaurants.',
          )
        }

        const result: RestaurantResponse = await response.json()

        if (!Array.isArray(result.restaurants)) {
          throw new Error('The server returned an invalid restaurant list.')
        }

        if (!controller.signal.aborted) {
          setRestaurants(result.restaurants)
        }
      } catch (cause) {
        if (!controller.signal.aborted) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not load restaurants.',
          )
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false)
        }
      }
    }

    void loadRestaurants()

    return () => controller.abort()
  }, [lobbyId, attempt])

  return (
    <main
      id="main-content"
      className="discovery-page"
      tabIndex={-1}
    >
      <div className="discovery-page__heading">
        <div>
          <h1>Explore restaurants</h1>
          <p className="discovery-page__intro">
            Restaurants near your lobby's saved location.
            Other round filters have not been applied yet.
          </p>
        </div>

        <TextAction
          disabled={loading}
          onClick={() => setAttempt(value => value + 1)}
        >
          Refresh restaurants
        </TextAction>
      </div>

      {loading && <p role="status">Loading Restaurants</p>}

      {error && (
        <div role="alert">
          <p>{error}</p>
          <TextAction onClick={() => setAttempt(value => value + 1)}>
            Try Again
          </TextAction>
        </div>
      )}

      {!loading && !error && (
        <>
          <p className="discovery-page__intro" role="status">
            {restaurants.length === 0 ? 'No restaurants found. Try changing lobby location.' : `${restaurants.length} restaurants found.`}
          </p>

          <p className="discovery-page__intro">
            Restaurant information from Google Maps
          </p>
          <section
            className="discovery-restaurants"
            aria-label="Restaurants"
          >
            {restaurants.map(restaurant => (
              <article
                className="discovery-restaurant"
                key={restaurant.id}
              >
                <div className="discovery-restaurant__content" >
                  <h2 className="discovery-restaurant__name">
                    {restaurant.name}
                  </h2>

                  <p className="discovery-restaurant__meta">
                    {restaurant.category ? restaurant.category.replace(/_/g, ' ') : 'Restaurant'}
                  </p>

                  <p>{restaurant.address ?? 'Address unavailable'}</p>

                  {restaurant.googleMapsUri && (
                    <a
                      href={restaurant.googleMapsUri}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      View on Google Maps
                    </a>
                  )}

                </div>
              </article>
            ))}

          </section>

        </>
      )}

      <div className="discovery-demo-note">
        <p>
          Change the search location in your lobby settings,
          then return here to reload the results.
        </p>

        <TextAction to={generatePath(paths.lobby, { lobbyId })}>
          Back to lobby
        </TextAction>





      </div>


    </main>
  )
}


export function DiscoveryPreviewPage() {
  const { lobbyId } = useParams<'lobbyId'>()

  if (!lobbyId?.trim() || lobbyId.startsWith(':')) {
    return (
      <main id="main-content" className="route-placeholder">
        <h1>Lobby unavailable</h1>
        <TextAction to={paths.joinLobby}>
          Enter lobby code
        </TextAction>
      </main>
    )
  }

  return <DiscoveryPreviewScreen key={lobbyId} lobbyId={lobbyId} />
}
