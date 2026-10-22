import { useLiveLobby } from '../features/lobby/liveLobby'
import { useState } from 'react'
import { generatePath, useParams } from 'react-router'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { TextInput, SelectField } from '../components/ui/FormField'
import { LobbyCode } from '../components/lobby/LobbyCode'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import './LobbyPage.css'

function LobbyScreen({ lobbyId }: { lobbyId: string }) {
  const { lobby, error, notice, connection, refresh, mutate: requestMutation } = useLiveLobby()
  const [editingFilters, setEditingFilters] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [editorVersion, setEditorVersion] = useState(0)
  async function mutate(path: string, body: Record<string, unknown>, leave = false) {
    setBusy(true); setActionError('')
    try {
      await requestMutation(path, leave ? 'POST' : 'PATCH', body)
      setEditorVersion(value => value + 1)
      if (path === '/filters') setEditingFilters(false)
    } catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Request failed.') }
    finally { setBusy(false) }
  }
  async function deleteLobby() {
    if (!window.confirm('Delete this lobby and its chat history?')) return
    setBusy(true); setActionError('')
    try { await requestMutation('', 'DELETE') }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not delete lobby.') }
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
      {(error || actionError) && <p role="alert">{actionError || error}</p>}
      <p role="status">{connection}</p>
      {!lobby && error && <TextAction to={paths.joinLobby}>Join with invitation code</TextAction>}
      <p role="status">{notice}</p>
      <TextAction disabled={busy} onClick={refresh}>Refresh lobby</TextAction>
      {lobby && <div className="lobby-page__columns">
        <section>
         <h2 className="lobby-section-heading">
  Members · {lobby.members.length}
</h2>

<ul className="lobby-members__list">
  {lobby.members.map(member => (
    <li key={member.memberId} className="lobby-member">
      <span className="lobby-avatar" aria-hidden="true">
        {member.displayName.slice(0, 2).toUpperCase()}
      </span>

      <div className="lobby-member__identity">
        <strong>{member.displayName}{member.memberId === lobby.selfMemberId ? " (you)" : ""}</strong>
        <p>{member.memberId === lobby.hostMemberId ? "Host · " : ""}{member.type === "guest" ? "Guest · " : ""}{member.online ? "Online" : "Offline"}</p>
      </div>
    </li>
  ))}

</ul>
          {!lobby.members.length && <p>Share your code to invite your crew.</p>}
          <p>Lobby status: {lobby.status}</p>
          {lobby.isHost && <details className="lobby-settings-editor">
          <summary>Edit lobby settings</summary>

          <form key={`settings-${editorVersion}`} onSubmit={saveSettings} className="lobby-filter-editor">
            <fieldset disabled={busy} className="lobby-filter-editor__group">
              <legend>Lobby settings</legend>
              <TextInput label="Lobby name" name="name" required maxLength={120} defaultValue={lobby.name} />
              <SelectField label="Status" name="status" defaultValue={lobby.status}>
                <option value="waiting">Waiting</option><option value="playing">Playing</option><option value="finished">Finished</option>
              </SelectField>
              <Button type="submit">Save settings</Button>
            </fieldset>
          </form>
          </details>}
          <Button disabled={busy} variant="secondary" onClick={() => void mutate('/leave', {}, true)}>{busy ? 'Please wait…' : 'Leave lobby'}</Button>
          {lobby.isHost && <TextAction tone="danger" disabled={busy} onClick={() => void deleteLobby()}>Delete lobby</TextAction>}
          {!lobby.isHost && <p>Only the host can change settings, filters, or the round status.</p>}
        </section>
        <section className="lobby-page__filters">
        <LobbyCode code={lobby.lobbyCode} />
        <div className="lobby-round-filters_controls">
        {lobby.isHost && <TextAction
           aria-expanded={editingFilters} onClick={() => setEditingFilters(current=>!current)}
           >
            {editingFilters ? 'Close editor': 'Edit filters'}
            </TextAction>}
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
        {lobby.isHost && editingFilters && (
        <form key={`filters-${editorVersion}`} onSubmit={saveFilters} className="lobby-filter-editor">
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
            <TextAction to={generatePath(paths.groupChat, params)}>Open chat</TextAction>
          </div>
          <p>Restaurant browsing, voting, and results currently use demo data. Votes stay in this browser tab.</p>
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
