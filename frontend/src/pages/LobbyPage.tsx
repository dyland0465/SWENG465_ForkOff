import { useState } from 'react'
import type { FormEvent } from 'react'
import { generatePath, useNavigate, useParams } from 'react-router'
import { LobbyCode } from '../components/lobby/LobbyCode'
import { PlayerList } from '../components/lobby/PlayerList'
import type { LobbyMember } from '../components/lobby/PlayerCard'
import {
  cuisineOptions, priceOptions, diningOptions, distanceOptions, ratingOptions,
  toggleOption, validateLocation,
} from '../components/lobby/lobbyForm'
import { useLobbyForm } from '../components/lobby/useLobbyForm'
import { Button } from '../components/ui/Button'
import { FilterChip } from '../components/ui/FilterChip'
import { SelectField, TextInput } from '../components/ui/FormField'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import './LobbyPage.css'

// Figma demonstration data, never a response for the lobby ID in the URL.
const demoMembers: readonly LobbyMember[] = [
  { name: 'Jordan Reed', initials: 'JR', role: 'Lobby leader', ready: true },
  { name: 'Avery Chen', initials: 'AC', role: 'Member · Ready', ready: true },
  { name: 'Maya Singh', initials: 'MS', role: 'Member · Ready', ready: true },
  { name: 'Sam Kim', initials: 'SK', role: 'Member · Choosing preferences', ready: false },
]
const demoMessages = [
  { name: 'Avery Chen', initials: 'AC', time: '7:42 PM', message: 'Ramen sounds perfect tonight.' },
  { name: 'Jordan Reed', initials: 'JR', time: '7:43 PM', message: 'I’m good with the top three—no spoilers yet.' },
  { name: 'Maya Singh', initials: 'MS', time: '7:44 PM', message: 'Copper Bowl has great mocktails.' },
]
type RoundFilters = {
  location: string
  time: string
  distance: string
  rating: string
  cuisines: string[]
  prices: string[]
  diningNeeds: string[]
}
const demoFilters: RoundFilters = {
  location: 'Erie, PA', time: '19:30', distance: '5', rating: '4.0',
  cuisines: ['Italian', 'Ramen'], prices: ['$$'], diningNeeds: ['Open at dining time', 'Mocktails'],
}

function displayTime(value: string) {
  const [hour, minute] = value.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

function hasDemoFilters(filters: RoundFilters) {
  const sameOptions = (a: string[], b: string[]) => a.length === b.length && a.every(value => b.includes(value))
  return filters.location === demoFilters.location && filters.time === demoFilters.time
    && filters.distance === demoFilters.distance && filters.rating === demoFilters.rating
    && sameOptions(filters.cuisines, demoFilters.cuisines)
    && sameOptions(filters.prices, demoFilters.prices)
    && sameOptions(filters.diningNeeds, demoFilters.diningNeeds)
}

function FilterEditor({ filters, onApply, onCancel }: {
  filters: RoundFilters
  onApply: (filters: RoundFilters) => void
  onCancel: () => void
}) {
  const { values, errors, setValue, onBlur, validate } = useLobbyForm(
    { location: filters.location, time: filters.time, distance: filters.distance, rating: filters.rating },
    {
      location: validateLocation,
      time: value => /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? undefined : 'Choose a dining time.',
      distance: value => distanceOptions.some(option => option === value) ? undefined : 'Choose a distance.',
      rating: value => ratingOptions.some(option => option === value) ? undefined : 'Choose a minimum rating.',
    },
  )
  const [cuisines, setCuisines] = useState(filters.cuisines)
  const [prices, setPrices] = useState(filters.prices)
  const [diningNeeds, setDiningNeeds] = useState(filters.diningNeeds)

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (validate(event.currentTarget)) {
      onApply({ ...values, location: values.location.trim(), cuisines, prices, diningNeeds })
    }
  }

  return (
    <form className="lobby-filter-editor" noValidate onSubmit={submit}>
      <p className="text-caption-default">Demo settings only. Apply updates this preview; nothing is saved.</p>
      <div className="lobby-filter-editor__fields">
        <TextInput label="Location" name="location" required maxLength={120} autoFocus value={values.location} error={errors.location} onChange={event => setValue('location', event.target.value)} onBlur={() => onBlur('location')} />
        <TextInput label="Dining time (demo)" name="time" type="time" required value={values.time} error={errors.time} onChange={event => setValue('time', event.target.value)} onBlur={() => onBlur('time')} />
        <SelectField label="Distance" name="distance" value={values.distance} error={errors.distance} onChange={event => setValue('distance', event.target.value)}>
          {distanceOptions.map(distance => <option key={distance} value={distance}>Within {distance} {distance === '1' ? 'mile' : 'miles'}</option>)}
        </SelectField>
        <SelectField label="Minimum rating" name="rating" value={values.rating} error={errors.rating} onChange={event => setValue('rating', event.target.value)}>
          {ratingOptions.map(rating => <option key={rating} value={rating}>{rating === 'any' ? 'Any rating' : `${rating} and up`}</option>)}
        </SelectField>
      </div>
      <fieldset className="lobby-filter-editor__group">
        <legend>Cuisine</legend>
        <div className="lobby-filter-chips">{cuisineOptions.map(option => <FilterChip key={option} selected={cuisines.includes(option)} onClick={() => setCuisines(previous => toggleOption(previous, option))}>{option}</FilterChip>)}</div>
      </fieldset>
      <fieldset className="lobby-filter-editor__group">
        <legend>Price</legend>
        <div className="lobby-filter-chips">{priceOptions.map(option => <FilterChip key={option} selected={prices.includes(option)} onClick={() => setPrices(previous => toggleOption(previous, option))}>{option}</FilterChip>)}</div>
      </fieldset>
      <fieldset className="lobby-filter-editor__group">
        <legend>Dining needs</legend>
        <div className="lobby-filter-chips">{diningOptions.map(option => <FilterChip key={option} selected={diningNeeds.includes(option)} onClick={() => setDiningNeeds(previous => toggleOption(previous, option))}>{option}</FilterChip>)}</div>
      </fieldset>
      <div className="lobby-actions">
        <Button type="submit">Apply locally</Button>
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
      </div>
    </form>
  )
}

function LobbyScreen({ lobbyId }: { lobbyId: string }) {
  const navigate = useNavigate()
  const [filters, setFilters] = useState(demoFilters)
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState('leader')
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')
  const isLeader = role === 'leader'
  // The installed React Router encodes parameters in generatePath.
  const routeParams = { lobbyId }
  const selectedChips = [
    ...filters.cuisines.map(label => ({ label, group: 'cuisines' as const, value: label })),
    ...filters.prices.map(label => ({ label, group: 'prices' as const, value: label })),
    ...(filters.rating !== 'any' ? [{ label: `${filters.rating}+`, group: 'rating' as const, value: filters.rating }] : []),
    ...filters.diningNeeds.map(value => ({ label: value === 'Open at dining time' ? 'Open now' : value, group: 'diningNeeds' as const, value })),
  ]

  function resetFilters() {
    setFilters(previous => ({ ...previous, distance: '5', rating: 'any', cuisines: [], prices: [], diningNeeds: [] }))
    setEditing(false)
    setStatus('Filters reset locally. No changes have been saved.')
  }

  return (
    <main id="main-content" className="lobby-page" tabIndex={-1}>
      <div className="lobby-page__columns">
        <div className="lobby-page__people">
          <div className="lobby-page__title">
            <h1>Friday Food Crew</h1>
            <span className="lobby-page__demo-label">Demo data</span>
          </div>
          <p className="lobby-page__intro">Waiting for everyone to get ready.</p>
          <PlayerList members={demoMembers} />
          <section className="lobby-chat-preview" aria-label="Recent messages (demonstration)">
            <ol className="lobby-chat-preview__messages">
              {demoMessages.map(message => (
                <li key={message.name} className="lobby-chat-preview__message">
                  <span className="lobby-avatar lobby-avatar--chat" aria-hidden="true">{message.initials}</span>
                  <div>
                    <p className="lobby-chat-preview__sender">{message.name} · {message.time}</p>
                    <p className="lobby-chat-preview__bubble">{message.message}</p>
                  </div>
                </li>
              ))}
            </ol>
            <label className="lobby-visually-hidden" htmlFor="lobby-message-draft">Message draft (local only, not sent)</label>
            <input id="lobby-message-draft" className="lobby-chat-preview__draft" placeholder="Write a message…" maxLength={500} value={draft} onChange={event => setDraft(event.target.value)} aria-describedby="lobby-demo-note lobby-draft-status" />
            <p id="lobby-draft-status" className="lobby-chat-preview__draft-status" role="status">{draft ? 'Draft only · not sent or saved.' : ''}</p>
          </section>
          <TextAction className="lobby-page__leave" tone="danger" to={paths.home} aria-describedby="lobby-demo-note">Leave lobby</TextAction>
        </div>

        <div className="lobby-page__settings">
          <LobbyCode code="FORK42" />
          <section className="lobby-round-filters" aria-labelledby="lobby-filters-heading">
            <h2 id="lobby-filters-heading" className="lobby-section-heading">Round filters</h2>
            <p className="lobby-round-filters__summary">{filters.location} · tonight at {displayTime(filters.time)} · within {filters.distance} {filters.distance === '1' ? 'mile' : 'miles'}</p>
            {editing ? (
              <FilterEditor filters={filters} onApply={next => { setFilters(next); setEditing(false); setStatus('Filters applied locally. No changes have been saved.') }} onCancel={() => setEditing(false)} />
            ) : (
              <>
                <div className="lobby-filter-chips" aria-label="Selected round filters">
                  {selectedChips.length ? selectedChips.map(chip => (
                    <FilterChip key={`${chip.group}-${chip.value}`} selected disabled={!isLeader} aria-label={`Remove ${chip.label} filter locally`} onClick={() => {
                      setFilters(previous => chip.group === 'rating'
                        ? { ...previous, rating: 'any' }
                        : { ...previous, [chip.group]: previous[chip.group].filter(value => value !== chip.value) })
                      setStatus('Filter removed locally. No changes have been saved.')
                    }}>{chip.label}</FilterChip>
                  )) : <p className="text-caption-default">Any cuisine · Any price · Any rating · No dining requirements</p>}
                </div>
                <div className="lobby-round-filters__matches">
                  <h3>{hasDemoFilters(filters) ? '18 eligible restaurants · demo' : 'Matches not calculated'}</h3>
                  <p>{hasDemoFilters(filters) ? 'Great variety for a decisive round.' : 'Restaurant counts require a connected backend.'}</p>
                </div>
                <div className="lobby-round-filters__controls">
                  <TextAction disabled={!isLeader} onClick={() => setEditing(true)}>Edit filters</TextAction>
                  <TextAction disabled={!isLeader} onClick={resetFilters}>Reset</TextAction>
                </div>
              </>
            )}
          </section>
          <div className="lobby-actions lobby-page__navigation">
            <Button disabled={!isLeader} onClick={() => navigate(generatePath(paths.discoveryPreview, routeParams))} aria-describedby="lobby-navigation-note">Start voting</Button>
            <Button variant="secondary" onClick={() => navigate(generatePath(paths.groupChat, routeParams))} aria-describedby="lobby-navigation-note">Open group chat</Button>
          </div>
          <div className="lobby-page__host-controls">
            <TextAction tone="danger" disabled={!isLeader} onClick={() => setStatus('Closing a lobby requires a connected backend and a verified leader. This demo remains open.')}>Close lobby for everyone</TextAction>
            <p>Only the lobby leader can close the lobby or start voting.</p>
          </div>
          <p className="lobby-page__status" role="status">{status}</p>
        </div>
      </div>
      <aside className="lobby-demo-note" aria-label="Demonstration details">
        <p id="lobby-demo-note"><strong>Frontend demonstration.</strong> Lobby data has not been loaded for route ID <span className="lobby-demo-note__id">{lobbyId}</span>. Names, roles, invitation code, filters, restaurant count, and messages are sample data. Edits and drafts are temporary. Leaving returns home without changing membership.</p>
        <p id="lobby-navigation-note">Start voting opens the existing discovery placeholder; it does not start a round. Open group chat opens a temporary, unsaved chat preview.</p>
        <SelectField label="Preview role (demo only)" value={role} onChange={event => { setRole(event.target.value); setEditing(false); setStatus('') }}>
          <option value="leader">Lobby leader</option>
          <option value="member">Member</option>
        </SelectField>
      </aside>
    </main>
  )
}

export function LobbyPage() {
  const { lobbyId } = useParams<'lobbyId'>()
  if (!lobbyId?.trim() || lobbyId.startsWith(':')) {
    return (
      <main id="main-content" className="route-placeholder" tabIndex={-1}>
        <h1 className="text-heading-h1">Lobby ID unavailable</h1>
        <p className="text-body-large">Open a lobby link with its ID to view this screen.</p>
        <TextAction to={paths.joinLobby}>Enter lobby code</TextAction>
      </main>
    )
  }
  // Reset all temporary data when Back/Forward or a new URL changes the lobby ID.
  return <LobbyScreen key={lobbyId} lobbyId={lobbyId} />
}
