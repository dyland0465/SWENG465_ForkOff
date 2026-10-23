import { useRef, useState } from 'react'
import { generatePath, useParams } from 'react-router'
import { FilterChip } from '../components/ui/FilterChip'
import { TextAction } from '../components/ui/TextAction'
import { RestaurantFilterEditor } from '../features/preferences/RestaurantFilterEditor'
import { useRestaurantPreferences } from '../features/preferences/useRestaurantPreferences'
import { defaultRestaurantPreferences, formatPreferenceAvailability, formatPreferenceDistance, formatPreferenceSchedule, hasDefaultPreferences } from '../features/preferences/restaurantPreferences'
import type { RestaurantPreferences } from '../features/preferences/restaurantPreferences'
import { demoRestaurants } from '../data/demoRestaurants'
import { paths } from '../routes/paths'
import './DiscoveryPreviewPage.css'

function DiscoveryPreviewScreen({ lobbyId }: { lobbyId: string }) {
  const { filters, setFilters, resetFilters } = useRestaurantPreferences(lobbyId)
  const [editing, setEditing] = useState(false)
  const changed = !hasDefaultPreferences(filters)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const editRef = useRef<HTMLButtonElement>(null)
  const routeParams = { lobbyId }

  function updateFilters(next: RestaurantPreferences, message = 'Demo round settings updated locally.') {
    setFilters(next)
    setStatus(`${message} Sample cards are unchanged; eligibility and totals require a backend.`)
  }

  function closeEditor() {
    setEditing(false)
    editRef.current?.focus()
  }

  return (
    <main id="main-content" className="discovery-page" tabIndex={-1}>
      <div className="discovery-page__heading">
        <div>
          <div className="discovery-page__title">
            <h1>{changed ? 'Preview your demo places' : '18 places made the cut'}</h1>
            <span className="discovery-page__demo-label">Demo data</span>
          </div>
          <p className="discovery-page__intro">Preview the field before everyone votes.</p>
        </div>
        <div className="discovery-page__controls">
          <TextAction ref={editRef} aria-expanded={editing} aria-controls="discovery-filter-editor" onClick={() => setEditing(previous => !previous)}>Edit filters</TextAction>
          <TextAction onClick={() => {
            resetFilters()
            setStatus('Demo defaults restored across screens for this lobby. Sample cards and existing votes are unchanged.')
            setEditing(false)
          }}>Reset</TextAction>
        </div>
      </div>

      <div id="discovery-filter-editor">
        {editing && <RestaurantFilterEditor variant="discovery" filters={filters} onCancel={closeEditor} onApply={next => { updateFilters(next); closeEditor() }} />}
      </div>

      <div className="discovery-filter-chips discovery-page__filters" aria-label="Demonstration round settings" aria-describedby="discovery-demo-note">
        <FilterChip selected onClick={() => setEditing(true)}>{filters.location}</FilterChip>
        <FilterChip selected={filters.distance !== 'any'} onClick={() => updateFilters({ ...filters, distance: filters.distance === 'any' ? '5' : 'any' })}>{formatPreferenceDistance(filters.distance)}</FilterChip>
        <FilterChip selected={!!filters.date || !!filters.time} onClick={() => { if (filters.time) updateFilters({ ...filters, time: '' }); else setEditing(true) }}>{formatPreferenceSchedule(filters)}</FilterChip>
        <FilterChip selected={!!filters.cuisines.length} onClick={() => updateFilters({ ...filters, cuisines: filters.cuisines.length ? [] : defaultRestaurantPreferences().cuisines })}>{filters.cuisines.length ? filters.cuisines.join(' + ') : 'Any cuisine'}</FilterChip>
        <FilterChip selected={!!filters.prices.length} onClick={() => updateFilters({ ...filters, prices: filters.prices.length ? [] : defaultRestaurantPreferences().prices })}>{filters.prices.join(' / ') || 'Any price'}</FilterChip>
        <FilterChip selected={filters.rating !== 'any'} onClick={() => updateFilters({ ...filters, rating: filters.rating === 'any' ? '4.0' : 'any' })}>{filters.rating === 'any' ? 'Any rating' : `${filters.rating}+`}</FilterChip>
        <FilterChip selected={filters.availability !== 'any'} onClick={() => updateFilters({ ...filters, availability: filters.availability === 'any' ? 'openNow' : 'any' })}>{formatPreferenceAvailability(filters.availability)}</FilterChip>
        {filters.diningNeeds.map(value => <FilterChip key={value} selected onClick={() => updateFilters({ ...filters, diningNeeds: filters.diningNeeds.filter(option => option !== value) })}>{value}</FilterChip>)}
      </div>

      <section className="discovery-restaurants" aria-label="Sample restaurants from Figma">
        {demoRestaurants.map(restaurant => (
          <article className="discovery-restaurant" key={restaurant.id}>
            <button className="discovery-restaurant__toggle" aria-expanded={expanded === restaurant.id} aria-controls={`sample-${restaurant.id}`} aria-label={`${restaurant.name}, sample information`} onClick={() => setExpanded(previous => previous === restaurant.id ? null : restaurant.id)}>
              <img src={restaurant.photo} alt="" width="360" height="176" />
              <span className="discovery-restaurant__content">
                <span className="discovery-restaurant__name">{restaurant.name}</span>
                <span className="discovery-restaurant__meta">{restaurant.cuisine} · {restaurant.price} · {restaurant.rating}</span>
                <span className="discovery-restaurant__distance">{restaurant.distanceMiles} mi · Open now</span>
              </span>
            </button>
            <div id={`sample-${restaurant.id}`} className="discovery-restaurant__sample" hidden={expanded !== restaurant.id}>
              <h2>About this sample</h2>
              <p>{restaurant.name} is demonstration content from Figma. Its photo, rating, price, distance, and open status are examples, not verified restaurant information.</p>
            </div>
          </article>
        ))}
      </section>

      <section className="discovery-options" aria-labelledby="discovery-options-heading">
        <div className="discovery-options__no-photo" aria-label="Photo unavailable for sample Lakeview Taqueria"><span>PHOTO<br />UNAVAILABLE</span></div>
        <div className="discovery-options__copy">
          <h2 id="discovery-options-heading">Only a few options?</h2>
          <p>{changed
            ? 'Lakeview Taqueria is a missing-photo example. Sample cards stay in this preview while you adjust settings; eligibility has not been checked.'
            : 'Lakeview Taqueria is a sample without a photo; eligibility has not been checked. Keep it in the demo or widen distance to 8 miles.'}</p>
        </div>
        <div className="discovery-options__actions">
          <TextAction to={generatePath(paths.voting, routeParams)} aria-describedby="discovery-demo-note">{changed ? 'Continue to voting' : 'Keep 18 and start'}</TextAction>
          <TextAction disabled={filters.distance === 'any' || Number(filters.distance) >= 8} onClick={() => updateFilters({ ...filters, distance: '8' }, 'Demo distance widened to 8 miles.')}>{filters.distance === 'any' ? 'Any distance selected' : Number(filters.distance) >= 8 ? `Distance set to ${filters.distance} mi` : 'Widen distance'}</TextAction>
        </div>
      </section>

      <aside className="discovery-demo-note" aria-label="Demonstration details">
        <p id="discovery-demo-note"><strong>Frontend demonstration.</strong> The 18-place count, restaurants, ratings, distances, and open statuses are Figma samples, not live results or verified matches. Filters stay in memory per lobby across navigation and clear on refresh; sample cards and existing votes stay unchanged. Lobby <span>{lobbyId}</span> is not loaded. Continue opens a local voting demo without starting a group round.</p>
        <p className="discovery-page__status" role="status">{status}</p>
        <TextAction to={generatePath(paths.lobby, routeParams)}>Back to lobby</TextAction>
      </aside>
    </main>
  )
}

export function DiscoveryPreviewPage() {
  const { lobbyId } = useParams<'lobbyId'>()
  if (!lobbyId?.trim() || lobbyId.startsWith(':')) {
    return (
      <main id="main-content" className="route-placeholder" tabIndex={-1}>
        <h1 className="text-heading-h1">Lobby ID unavailable</h1>
        <p className="text-body-large">Open a lobby link with its ID to preview discovery.</p>
        <TextAction to={paths.joinLobby}>Enter lobby code</TextAction>
      </main>
    )
  }
  return <DiscoveryPreviewScreen key={lobbyId} lobbyId={lobbyId} />
}
