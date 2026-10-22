import { useLayoutEffect, useRef, useState } from 'react'
import { generatePath, useNavigate, useParams } from 'react-router'
import { LobbyCode } from '../components/lobby/LobbyCode'
import { PlayerList } from '../components/lobby/PlayerList'
import type { LobbyMember } from '../components/lobby/PlayerCard'
import { Button } from '../components/ui/Button'
import { FilterChip } from '../components/ui/FilterChip'
import { SelectField } from '../components/ui/FormField'
import { RestaurantFilterEditor } from '../features/preferences/RestaurantFilterEditor'
import { useRestaurantPreferences } from '../features/preferences/useRestaurantPreferences'
import { formatPreferenceAvailability, formatPreferenceDistance, formatPreferenceSchedule, hasDefaultPreferences } from '../features/preferences/restaurantPreferences'
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
function LobbyScreen({ lobbyId }: { lobbyId: string }) {
  const navigate = useNavigate()
  const { filters, setFilters, resetFilters: resetSharedFilters } = useRestaurantPreferences(lobbyId)
  const [editing, setEditing] = useState(false)
  const [role, setRole] = useState('leader')
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')
  const editFiltersRef = useRef<HTMLButtonElement>(null)
  const restoreFilterFocus = useRef(false)
  const isLeader = role === 'leader'

  useLayoutEffect(() => {
    if (!editing && restoreFilterFocus.current) {
      // The trigger is unmounted while editing; wait until it exists again.
      editFiltersRef.current?.focus()
      restoreFilterFocus.current = false
    }
  }, [editing])

  function closeFilterEditor() {
    restoreFilterFocus.current = true
    setEditing(false)
  }
  // The installed React Router encodes parameters in generatePath.
  const routeParams = { lobbyId }
  const selectedChips = [
    ...filters.cuisines.map(label => ({ label, group: 'cuisines' as const, value: label })),
    ...filters.prices.map(label => ({ label, group: 'prices' as const, value: label })),
    ...(filters.rating !== 'any' ? [{ label: `${filters.rating}+`, group: 'rating' as const, value: filters.rating }] : []),
    ...filters.diningNeeds.map(value => ({ label: value, group: 'diningNeeds' as const, value })),
  ]

  function resetFilters() {
    resetSharedFilters()
    setEditing(false)
    setStatus('Demo defaults restored across screens for this lobby. Existing votes are unchanged.')
  }

  return (
    <main id="main-content" className="lobby-page" tabIndex={-1}>
      <div className="lobby-page__columns">
        {/* Keep each column together when stacked so visual and keyboard order agree. */}
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
            <p className="lobby-round-filters__summary">{filters.location} · {formatPreferenceSchedule(filters)} · {formatPreferenceDistance(filters.distance)}</p>
            {editing ? (
              <RestaurantFilterEditor variant="lobby" filters={filters} onApply={next => { setFilters(next); closeFilterEditor(); setStatus('Filters applied across screens for this lobby for this visit. Existing votes are unchanged.') }} onCancel={closeFilterEditor} />
            ) : (
              <>
                <div className="lobby-filter-chips" aria-label="Selected round filters">
                  {filters.availability !== 'any' && <FilterChip selected disabled={!isLeader} aria-label={`Remove ${formatPreferenceAvailability(filters.availability)} filter locally`} onClick={() => { setFilters({ ...filters, availability: 'any' }); setStatus('Availability removed locally. Existing votes are unchanged.') }}>{formatPreferenceAvailability(filters.availability)}</FilterChip>}
                  {selectedChips.length ? selectedChips.map(chip => (
                    <FilterChip key={`${chip.group}-${chip.value}`} selected disabled={!isLeader} aria-label={`Remove ${chip.label} filter locally`} onClick={() => {
                      setFilters(chip.group === 'rating'
                        ? { ...filters, rating: 'any' }
                        : { ...filters, [chip.group]: filters[chip.group].filter(value => value !== chip.value) })
                      setStatus('Filter removed locally. No changes have been saved.')
                    }}>{chip.label}</FilterChip>
                  )) : <p className="text-caption-default">Any cuisine · Any price · Any rating · No dining requirements</p>}
                </div>
                <div className="lobby-round-filters__matches">
                  <h3>{hasDefaultPreferences(filters) ? '18 sample restaurants · demo' : 'Matches not calculated'}</h3>
                  <p>{hasDefaultPreferences(filters) ? 'Sample count only; eligibility has not been checked.' : 'Restaurant counts require a connected backend.'}</p>
                </div>
                <div className="lobby-round-filters__controls">
                  <TextAction ref={editFiltersRef} disabled={!isLeader} aria-expanded={editing} aria-controls="lobby-filter-form" onClick={() => setEditing(true)}>Edit filters</TextAction>
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
        <p id="lobby-demo-note"><strong>Frontend demonstration.</strong> Lobby data has not been loaded for route ID <span className="lobby-demo-note__id">{lobbyId}</span>. Names, roles, invitation code, filters, restaurant count, and messages are sample data. Filter edits stay in memory per lobby across navigation and clear on refresh. Chat drafts are temporary. Leaving returns home without changing membership.</p>
        <p id="lobby-navigation-note">Start voting opens Discovery Preview with demonstration restaurants; it does not start a round. Open group chat opens a temporary, unsaved chat preview.</p>
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
  // Page-only UI resets by ID; shared preferences remain in the app provider.
  return <LobbyScreen key={lobbyId} lobbyId={lobbyId} />
}
