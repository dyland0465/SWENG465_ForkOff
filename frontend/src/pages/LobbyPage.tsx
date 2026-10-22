import { useEffect, useState } from 'react'
import { generatePath, useLocation, useNavigate, useParams } from 'react-router'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { TextInput, SelectField } from '../components/ui/FormField'
import { LobbyCode } from '../components/lobby/LobbyCode'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import './LobbyPage.css'

type Lobby = {
  id: string; name: string; lobbyCode: string; status: string
  members: { _id: string; username: string }[]
  guestMembers: { guestId: string; displayName: string }[]
  filters?: { openNow?: boolean; location?: string; dinnerAt?: string; maxDistance?: number; minimumRating?: number; categories?: string[]; priceLevels?: string[]; diningNeeds?: string[] }
}

function LobbyScreen({ lobbyId }: { lobbyId: string }) {
  const [editingFilters, setEditingFilters] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()
  const [member] = useState<{ guestId?: string; userId?: string } | null>(() => {
    try { return JSON.parse(sessionStorage.getItem(`lobby-member:${lobbyId}`) ?? 'null') ?? location.state?.member ?? null }
    catch { return location.state?.member ?? null }
  })
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const base = `/api/lobbies/${encodeURIComponent(lobbyId)}`
        const [data, members, filters] = await Promise.all(['', '/members', '/filters'].map(async path => {
          const response = await fetch(base + path, { signal: controller.signal })
          const result = await response.json()
          if (!response.ok) throw new Error(result.message || 'Could not load lobby.')
          return result
        }))
        if (!controller.signal.aborted) { setLobby({ ...data, members: members.members, guestMembers: members.guestMembers, filters: filters.filters }); setError('') }
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load lobby.')
      }
    }
    void load()
    return () => controller.abort()
  }, [lobbyId, attempt])
  async function mutate(path: string, body: Record<string, unknown>, leave = false) {
    setBusy(true); setError(''); setNotice('')
    try {
      const response = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}${path}`, {
        method: leave ? 'POST' : 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.message || 'Could not save changes.')
      if (leave) {
        try { sessionStorage.removeItem(`lobby-member:${lobbyId}`) } catch { /* Storage may be unavailable. */ }
        navigate(paths.home, { replace: true })
      } else { setNotice('Changes saved.'); setAttempt(value => value + 1) }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Request failed. Please try again.') }
    finally { setBusy(false) }
  }
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    void mutate('', { name: values.get('name'), status: values.get('status') })
  }
  function saveFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const list = (key: string) => String(values.get(key) ?? '').split(',').map(value => value.trim()).filter(Boolean)
    const dinner = String(values.get('dinnerAt') ?? '')
    void mutate('/filters', {
      location: values.get('location'), maxDistance: Number(values.get('maxDistance')), minimumRating: Number(values.get('minimumRating')),
      categories: list('categories'), priceLevels: values.getAll('priceLevels'), diningNeeds: list('diningNeeds'), openNow: values.has('openNow'),
      ...(dinner ? { dinnerAt: new Date(dinner).toISOString() } : {}),
    })
  }
  const filters = lobby?.filters
  const params = { lobbyId }
  return (
    <main id="main-content" className="lobby-page" tabIndex={-1}>
      <h1>{lobby?.name ?? 'Your dinner crew'}</h1>
      {!lobby && !error && <p role="status">Loading lobby…</p>}
      {error && <p role="alert">{error}</p>}
      <p role="status">{notice}</p>
      <TextAction disabled={busy} onClick={() => { setLobby(null); setError(''); setAttempt(value => value + 1) }}>Refresh lobby</TextAction>
      {lobby && <div className="lobby-page__columns">
        <section>
         <h2 className="lobby-section-heading">
  Members · {lobby.members.length + lobby.guestMembers.length}
</h2>

<ul className="lobby-members__list">
  {lobby.members.map(member => (
    <li key={member._id} className="lobby-member">
      <span className="lobby-avatar" aria-hidden="true">
        {member.username.slice(0, 2).toUpperCase()}
      </span>

      <div className="lobby-member__identity">
        <strong>{member.username}</strong>
      </div>
    </li>
  ))}

  {lobby.guestMembers.map(guest => (
    <li key={guest.guestId} className="lobby-member">
      <span className="lobby-avatar" aria-hidden="true">
        {guest.displayName.slice(0, 2).toUpperCase()}
      </span>

      <div className="lobby-member__identity">
        <strong>{guest.displayName}</strong>
        <p className="text-caption-default">Guest</p>
      </div>
    </li>
  ))}
</ul> 
          {!lobby.members.length && !lobby.guestMembers.length && <p>Share your code to invite your crew.</p>}
          <p>Lobby status: {lobby.status}</p>
          <details className="lobby-settings-editor">
          <summary>Edit lobby settings</summary>
         
          <form key={`settings-${attempt}`} onSubmit={saveSettings} className="lobby-filter-editor">
            <fieldset disabled={busy} className="lobby-filter-editor__group">
              <legend>Lobby settings</legend>
              <TextInput label="Lobby name" name="name" required maxLength={120} defaultValue={lobby.name} />
              <SelectField label="Status" name="status" defaultValue={lobby.status}>
                <option value="waiting">Waiting</option><option value="playing">Playing</option><option value="finished">Finished</option>
              </SelectField>
              <Button type="submit">Save settings</Button>
            </fieldset>
          </form>
          </details>
          {member && <Button disabled={busy} variant="secondary" onClick={() => void mutate('/leave', member, true)}>{busy ? 'Please wait…' : 'Leave lobby'}</Button>}
          {!member && <p>Join this lobby with its invitation code to save your membership on this browser and use Leave lobby.</p>}
        </section>
        <section className="lobby-page__filters">
        <LobbyCode code={lobby.lobbyCode} />
        <div className="lobby-round-filters_controls">
        <TextAction
           aria-expanded={editingFilters} onClick={() => setEditingFilters(current=>!current)}
           >
            {editingFilters ? 'Close editor': 'Edit filters'}
            </TextAction> 
          </div>

        <h2>Round filters</h2>
        <p>{filters?.location} {filters?.dinnerAt && `· ${new Date(filters.dinnerAt).toLocaleString()}`}</p>
        <p>Within {filters?.maxDistance ?? 10} miles · Minimum rating: {filters?.minimumRating || 'Any'}</p>
        <div className="lobby-filter-chips">
          {[
            ...(filters?.categories?.length ? filters.categories : ['Any cuisine']),
            ...(filters?.priceLevels?.length ? filters.priceLevels : ['Any price']),
            ...(filters?.openNow ? ['Open now'] : []),
            ...(filters?.diningNeeds ?? []),
          ].map((label,index) => (
            <span className="lobby-filter-tag" key={`${label}-${index}`}>{label}</span>
          ))} 
          </div> 
        {editingFilters && (
        <form key={`filters-${attempt}`} onSubmit={saveFilters} className="lobby-filter-editor">
          <fieldset disabled={busy} className="lobby-filter-editor__group">
            <legend>Edit round filters</legend>
            <div className="lobby-filter-editor__fields">
              <TextInput label="Location" name="location" required maxLength={120} defaultValue={filters?.location ?? ''} />
              <TextInput label="New dinner date and time (optional)" name="dinnerAt" type="datetime-local" hint="Leave blank to keep the current dinner time." />
              <TextInput label="Maximum distance (miles)" name="maxDistance" type="number" required min={1} max={100} step="any" defaultValue={filters?.maxDistance ?? 10} />
              <TextInput label="Minimum rating" name="minimumRating" type="number" required min={0} max={5} step="0.1" defaultValue={filters?.minimumRating ?? 0} />
              <TextInput label="Cuisines (comma separated)" name="categories" defaultValue={filters?.categories?.join(', ') ?? ''} />
              <TextInput label="Dining needs (comma separated)" name="diningNeeds" defaultValue={filters?.diningNeeds?.join(', ') ?? ''} />
         
            </div>
            <fieldset className="lobby-filter-editor__group"><legend>Price levels (none means any price)</legend>
              {['$', '$$', '$$$'].map(price => <label key={price}><input type="checkbox" name="priceLevels" value={price} defaultChecked={filters?.priceLevels?.includes(price)} />{price} </label>)}
              </fieldset>
              <label><input type="checkbox" name="openNow" defaultChecked={filters?.openNow ?? false} /> Open now</label>
              <Button type="submit">Save filters</Button>
            </fieldset>
          </form>
        )}
          <div className="lobby-actions">
            <TextAction to={generatePath(paths.discoveryPreview, params)}>Preview restaurants</TextAction>
            <TextAction to={generatePath(paths.voting, params)}>Try voting</TextAction>
            <TextAction to={generatePath(paths.results, params)}>Your voting results</TextAction>
            <TextAction to={generatePath(paths.groupChat, params)}>Preview chat</TextAction>
          </div>
          <p>Restaurant browsing, voting, results, and chat currently use demo data. Votes stay in this browser tab.</p>
        </section>
      </div>}
      <TextAction to={paths.home}>Back home</TextAction>
    </main>
  )
}

export function LobbyPage() {
  const { lobbyId = '' } = useParams()
  return <LobbyScreen key={lobbyId} lobbyId={lobbyId} />
}
