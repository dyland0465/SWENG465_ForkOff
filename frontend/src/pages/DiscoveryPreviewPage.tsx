import { GoogleMapsLink } from '../components/ui/GoogleMapsLink'
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
  photoUrl?: string | null
  photoAuthors?: {
    displayName: string
    uri?: string
  }[]

}

type RestaurantResponse = {
  lobbyId: string
  attribution: string
  count: number
  restaurants: Restaurant[]
}

function RestaurantPhoto({ restaurant }: { restaurant: Restaurant }) {
  const [failed, setFailed] = useState(false)

  if (!restaurant.photoUrl || failed) {
    return (
      <div className="discovery-restaurant__photo-placeholder">
        Photo Unavailable
      </div>
    )
  }
  return (
    <figure className="discovery-restaurant__photo">
      <img
        src={restaurant.photoUrl}
        alt={`Photo of ${restaurant.name}`}
        loading="lazy"
        onError={() => setFailed(true)}
      />

      {!!restaurant.photoAuthors?.length && (
        <figcaption>
          Photo: {' '}
          {restaurant.photoAuthors.map((author, index) => (
            <span key={`${author.displayName}-${index}`}>
              {index > 0 && ', '}
              {author.uri ? (
                <a
                  href={author.uri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {author.displayName}
                </a>
              ) : (
                author.displayName
              )}
            </span>
          ))}
        </figcaption>
      )}

    </figure>
  )
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
                <RestaurantPhoto
                  key={restaurant.photoUrl ?? 'no-photo'}
                  restaurant={restaurant}
                />
                <div className="discovery-restaurant__content" >
                  <h2 className="discovery-restaurant__name">
                    {restaurant.name}
                  </h2>

                  <p className="discovery-restaurant__meta">
                    {restaurant.category ? restaurant.category.replace(/_/g, ' ') : 'Restaurant'}
                  </p>

                  <p>{restaurant.address ?? 'Address unavailable'}</p>

                  {restaurant.googleMapsUri && (
                    <GoogleMapsLink href={restaurant.googleMapsUri} />
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
        <TextAction to={generatePath(paths.voting, { lobbyId })}>
          Open voting
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
