import { useState } from 'react'
import { generatePath, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { demoRestaurants } from '../data/demoRestaurants'
import type { DemoRestaurant } from '../data/demoRestaurants'
import mapMarker from '../assets/figma/restaurant-details/map-marker.svg'
import { paths } from '../routes/paths'
import './RestaurantDetailsPage.css'

const actions = ['View menu', 'Website', 'Call', 'Directions'] as const
type RestaurantAction = typeof actions[number]
const unavailableMessages: Record<RestaurantAction, string> = {
  'View menu': 'Menu not connected. This demonstration has no menu data or verified menu link.',
  Website: 'Website not connected. No verified restaurant website is available in the sample data.',
  Call: 'Calling not connected. No verified phone number is available in the sample data.',
  Directions: 'Directions not connected. The map is a static demonstration, not a geographic location or navigation service.',
}

function RestaurantDetailsScreen({ restaurant, lobbyId }: { restaurant: DemoRestaurant; lobbyId: string }) {
  const [action, setAction] = useState<RestaurantAction | null>(null)
  const sample = restaurant.sampleDetails
  const votingPath = generatePath(paths.voting, { lobbyId })

  return (
    <main id="main-content" className="restaurant-details-page" tabIndex={-1}>
      <header>
        <div className="restaurant-details__title">
          <h1>{restaurant.name}</h1>
          <span className="discovery-page__demo-label">Demo only</span>
        </div>
        <p className="restaurant-details__meta">{restaurant.cuisine} · {restaurant.price} · {restaurant.rating} · {restaurant.distanceMiles} miles away</p>
      </header>

      <div className="restaurant-details__visit-grid">
        <img className="restaurant-details__photo" src={restaurant.photo} width="560" height="360" alt={`${restaurant.name} demonstration photo`} />
        <section className="restaurant-details__visit" aria-labelledby="restaurant-visit-heading">
          <h2 id="restaurant-visit-heading">Visit <span className="restaurant-details__sample">Sample information</span></h2>
          <p className="restaurant-details__address">{sample?.address ?? 'Address unavailable in sample data.'}</p>
          <p className="restaurant-details__daily-hours">{sample ? `Sample daily hours · ${sample.dailyHours}` : 'Live opening status unavailable.'}</p>
          <h3>Hours <span className="restaurant-details__sample">Sample only</span></h3>
          <p className="restaurant-details__weekly-hours">{sample?.weeklyHours ?? 'Operating hours unavailable in sample data.'}</p>
          <div className="restaurant-details__actions" role="group" aria-label="Restaurant actions" aria-describedby="restaurant-services-note">
            {actions.map(label => (
              <Button key={label} variant={label === 'Directions' ? 'primary' : 'secondary'} onClick={() => setAction(label)}>{label}</Button>
            ))}
          </div>
          <div className="restaurant-details__action-status" role="status" aria-atomic="true">{action && unavailableMessages[action]}</div>
          <div className="restaurant-details__source">
            <p>Source: Figma demonstration · not verified</p>
            <p id="restaurant-services-note">Services not connected</p>
          </div>
        </section>
      </div>

      <div className="restaurant-details__map-grid">
        <section className="restaurant-details__map" aria-label={`Static demonstration map for ${restaurant.name}; not a real location`}>
          <div className="restaurant-details__streets" aria-hidden="true">
            <span className="restaurant-details__street restaurant-details__street--one" />
            <span className="restaurant-details__street restaurant-details__street--two" />
            <span className="restaurant-details__street restaurant-details__street--three" />
            <span className="restaurant-details__street restaurant-details__street--four" />
            <span className="restaurant-details__avenue restaurant-details__avenue--one" />
            <span className="restaurant-details__avenue restaurant-details__avenue--two" />
            <span className="restaurant-details__avenue restaurant-details__avenue--three" />
          </div>
          <div className="restaurant-details__map-location">
            <img src={mapMarker} width="28" height="28" alt="" />
            <p>{restaurant.name}</p>
          </div>
          <p className="restaurant-details__map-label">Static sample map · not a real location</p>
        </section>
        <aside className="restaurant-details__return" aria-labelledby="restaurant-return-heading">
          <h2 id="restaurant-return-heading">Back to your vote</h2>
          <p>Details don’t reveal or change anyone else’s vote.</p>
          <TextAction to={votingPath}>Return to voting</TextAction>
        </aside>
      </div>

      <details className="restaurant-details__about">
        <summary>About &amp; sample details</summary>
        <p>{sample?.description ?? 'A restaurant description is not available in the shared sample data.'}</p>
        <p>Sample features: {restaurant.features.join(' · ')}. These are demonstration values, not live availability.</p>
      </details>
      <p className="restaurant-details__demo-note">Sample photos, ratings, distances, address, and hours are not verified. No live restaurant services are connected. Your voting choices stay in memory for lobby <span>{lobbyId}</span> during navigation and clear on refresh.</p>
    </main>
  )
}

export function RestaurantDetailsPage() {
  const { lobbyId, restaurantId } = useParams<'lobbyId' | 'restaurantId'>()
  const validLobby = lobbyId?.trim() && !lobbyId.startsWith(':') ? lobbyId : undefined
  const restaurant = demoRestaurants.find(candidate => candidate.id === restaurantId)

  if (!validLobby || !restaurant) {
    return (
      <main id="main-content" className="route-placeholder" tabIndex={-1}>
        <h1 className="text-heading-h1">{!validLobby ? 'Lobby ID unavailable' : restaurantId ? 'Restaurant not found' : 'Choose a restaurant'}</h1>
        <p className="text-body-large">{!validLobby ? 'Open a lobby link with its ID to view restaurant details.' : 'Open restaurant details from Voting to view one of the three sample restaurants. Your existing choices have not changed.'}</p>
        <TextAction to={validLobby ? generatePath(paths.voting, { lobbyId: validLobby }) : paths.joinLobby}>{validLobby ? 'Return to voting' : 'Enter lobby code'}</TextAction>
      </main>
    )
  }

  return <RestaurantDetailsScreen key={`${validLobby}/${restaurant.id}`} restaurant={restaurant} lobbyId={validLobby} />
}
