import { useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { generatePath, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { FilterChip } from '../components/ui/FilterChip'
import { SelectField, TextInput } from '../components/ui/FormField'
import { TextAction } from '../components/ui/TextAction'
import { cuisineOptions, distanceOptions, priceOptions, ratingOptions, toggleOption } from '../components/lobby/lobbyForm'
import { demoRestaurants } from '../data/demoRestaurants'
import { paths } from '../routes/paths'
import './DiscoveryPreviewPage.css'

type PreviewFilters = {
  distance: string
  time: string
  cuisines: string[]
  price: string
  rating: string
  openNow: boolean
}

const initialFilters: PreviewFilters = {
  distance: '5', time: '19:30', cuisines: ['Italian', 'Ramen'], price: '$$', rating: '4.0', openNow: true,
}

function timeLabel(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')}${time === '19:30' ? '' : hour < 12 ? ' AM' : ' PM'}`
}

function PreviewFilterEditor({ filters, onApply, onCancel }: {
  filters: PreviewFilters
  onApply: (filters: PreviewFilters) => void
  onCancel: () => void
}) {
  const [draft, setDraft] = useState(filters)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    onApply(draft)
  }

  return (
    <form className="discovery-filter-editor" onSubmit={submit} aria-label="Edit demonstration filters">
      <h2 className="text-heading-h2">Edit filters</h2>
      <p>Adjust round settings locally. Sample cards stay visible; restaurant eligibility is not recalculated.</p>
      <div className="discovery-filter-editor__fields">
        <SelectField label="Distance" value={draft.distance} onChange={event => setDraft({ ...draft, distance: event.target.value })} autoFocus>
          <option value="any">Any distance</option>
          {distanceOptions.map(value => <option key={value} value={value}>Within {value} mi</option>)}
        </SelectField>
        <TextInput label="Dining time (demo)" type="time" hint="Leave blank for any time." value={draft.time} onChange={event => setDraft({ ...draft, time: event.target.value })} />
        <SelectField label="Price" value={draft.price} onChange={event => setDraft({ ...draft, price: event.target.value })}>
          <option value="any">Any price</option>
          {priceOptions.map(value => <option key={value}>{value}</option>)}
        </SelectField>
        <SelectField label="Minimum rating" value={draft.rating} onChange={event => setDraft({ ...draft, rating: event.target.value })}>
          {ratingOptions.map(value => <option key={value} value={value}>{value === 'any' ? 'Any rating' : `${value}+`}</option>)}
        </SelectField>
      </div>
      <fieldset>
        <legend>Cuisine</legend>
        <div className="discovery-filter-chips">
          {cuisineOptions.map(value => <FilterChip key={value} selected={draft.cuisines.includes(value)} onClick={() => setDraft({ ...draft, cuisines: toggleOption(draft.cuisines, value) })}>{value}</FilterChip>)}
        </div>
      </fieldset>
      <FilterChip selected={draft.openNow} onClick={() => setDraft({ ...draft, openNow: !draft.openNow })}>Open now</FilterChip>
      <div className="discovery-filter-editor__actions">
        <Button type="submit">Apply locally</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function DiscoveryPreviewScreen({ lobbyId }: { lobbyId: string }) {
  const [filters, setFilters] = useState(initialFilters)
  const [editing, setEditing] = useState(false)
  const [changed, setChanged] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [status, setStatus] = useState('')
  const editRef = useRef<HTMLButtonElement>(null)
  const routeParams = { lobbyId }

  function updateFilters(next: PreviewFilters, message = 'Demo round settings updated locally.') {
    setFilters(next)
    setChanged(true)
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
            updateFilters({ distance: 'any', time: '', cuisines: [], price: 'any', rating: 'any', openNow: false }, 'Demo filters cleared locally.')
            setEditing(false)
          }}>Reset</TextAction>
        </div>
      </div>

      <div id="discovery-filter-editor">
        {editing && <PreviewFilterEditor filters={filters} onCancel={closeEditor} onApply={next => { updateFilters(next); closeEditor() }} />}
      </div>

      <div className="discovery-filter-chips discovery-page__filters" aria-label="Demonstration round settings" aria-describedby="discovery-demo-note">
        <FilterChip selected={filters.distance !== 'any'} onClick={() => updateFilters({ ...filters, distance: filters.distance === 'any' ? '5' : 'any' })}>{filters.distance === 'any' ? 'Any distance' : `Within ${filters.distance} mi`}</FilterChip>
        <FilterChip selected={!!filters.time} onClick={() => { if (filters.time) updateFilters({ ...filters, time: '' }); else setEditing(true) }}>{filters.time ? `Tonight ${timeLabel(filters.time)}` : 'Any time'}</FilterChip>
        <FilterChip selected={!!filters.cuisines.length} onClick={() => updateFilters({ ...filters, cuisines: filters.cuisines.length ? [] : initialFilters.cuisines })}>{filters.cuisines.length ? filters.cuisines.join(' + ') : 'Any cuisine'}</FilterChip>
        <FilterChip selected={filters.price !== 'any'} onClick={() => updateFilters({ ...filters, price: filters.price === 'any' ? '$$' : 'any' })}>{filters.price === 'any' ? 'Any price' : filters.price}</FilterChip>
        <FilterChip selected={filters.rating !== 'any'} onClick={() => updateFilters({ ...filters, rating: filters.rating === 'any' ? '4.0' : 'any' })}>{filters.rating === 'any' ? 'Any rating' : `${filters.rating}+`}</FilterChip>
        <FilterChip selected={filters.openNow} onClick={() => updateFilters({ ...filters, openNow: !filters.openNow })}>Open now</FilterChip>
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
            : 'Lakeview Taqueria has no current photo, but still matches every group filter. Keep it in the round or widen distance to 8 miles.'}</p>
        </div>
        <div className="discovery-options__actions">
          <TextAction to={generatePath(paths.voting, routeParams)} aria-describedby="discovery-demo-note">{changed ? 'Continue to voting' : 'Keep 18 and start'}</TextAction>
          <TextAction disabled={filters.distance === 'any' || Number(filters.distance) >= 8} onClick={() => updateFilters({ ...filters, distance: '8' }, 'Demo distance widened to 8 miles.')}>{filters.distance === 'any' ? 'Any distance selected' : Number(filters.distance) >= 8 ? `Distance set to ${filters.distance} mi` : 'Widen distance'}</TextAction>
        </div>
      </section>

      <aside className="discovery-demo-note" aria-label="Demonstration details">
        <p id="discovery-demo-note"><strong>Frontend demonstration.</strong> The 18-place count, restaurants, ratings, distances, and open statuses are Figma samples, not live results or verified matches. Filters edit temporary settings; cards stay unchanged. Lobby <span>{lobbyId}</span> is not loaded. Continue opens a local voting demo without starting a group round.</p>
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
