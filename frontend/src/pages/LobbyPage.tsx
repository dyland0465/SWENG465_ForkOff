import { GroupControls } from '../features/saved/GroupControls'
import { lobbyRequest, useLiveLobby } from '../features/lobby/liveLobby'
import { useRef, useState } from 'react'
import { generatePath, useLocation, useNavigate, useParams } from 'react-router'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { TextInput, SelectField } from '../components/ui/FormField'
import { LobbyCode } from '../components/lobby/LobbyCode'
import { LobbyRestaurantPreview } from '../components/lobby/LobbyRestaurantPreview'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import './LobbyPage.css'

function LobbyScreen({ lobbyId }: { lobbyId: string }) {
  const {
    lobby,
    error,
    notice,
    connection,
    messages,
    sendMessage,
    mutate: requestMutation,
  } = useLiveLobby()
  const navigate = useNavigate()
  const location = useLocation()
  const invitationError = (location.state as { invitationError?: string } | null)?.invitationError
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const pendingMessage = useRef<{ text: string; requestId: string } | null>(
    null,
  )
  async function submitMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (sending || !draft.trim()) return
    const text = draft.trim()
    const request =
      pendingMessage.current?.text === text
        ? pendingMessage.current
        : { text, requestId: crypto.randomUUID() }
    pendingMessage.current = request
    setSending(true)
    setActionError('')
    try {
      await sendMessage(request.text, request.requestId)
      setDraft('')
      pendingMessage.current = null
    } catch (cause) {
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'Could not send message. Please retry.',
      )
    } finally {
      setSending(false)
    }
  }
  const [editingFilters, setEditingFilters] = useState(false)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [editorVersion, setEditorVersion] = useState(0)
  async function mutate(
    path: string,
    body: Record<string, unknown>,
    leave = false,
  ) {
    setBusy(true)
    setActionError('')
    try {
      await requestMutation(path, leave ? 'POST' : 'PATCH', body)
      setEditorVersion((value) => value + 1)
      if (path === '' && 'filters' in body) setEditingFilters(false)
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Request failed.')
    } finally {
      setBusy(false)
    }
  }
  async function deleteLobby() {
    if (!window.confirm('Delete this lobby and its chat history?')) return
    setBusy(true)
    setActionError('')
    try {
      await requestMutation('', 'DELETE')
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'Could not delete lobby.',
      )
    } finally {
      setBusy(false)
    }
  }
  async function startGame() {
    setBusy(true)
    setActionError('')
    try {
      await lobbyRequest(`/api/lobbies/${encodeURIComponent(lobbyId)}/round`, 'POST')
      navigate(generatePath(paths.voting, { lobbyId }))
    } catch (cause) {
      setActionError(cause instanceof Error ? cause.message : 'Could not start the game.')
    } finally { setBusy(false) }
  }
  function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const values = new FormData(event.currentTarget)
    const list = (key: string) =>
      String(values.get(key) ?? '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
    const dinner = String(values.get('dinnerAt') ?? '')
    void mutate('', {
      name: values.get('name'),
      status: values.get('status'),
      filters: {
        location: values.get('location'),
        maxDistance: Number(values.get('maxDistance')),
        minimumRating: Number(values.get('minimumRating')),
        categories: list('categories'),
        priceLevels: values.getAll('priceLevels'),
        diningNeeds: list('diningNeeds'),
        openNow: values.has('openNow'),
        ...(dinner ? { dinnerAt: new Date(dinner).toISOString() } : {}),
      },
    })
  }
  const filters = lobby?.filters
  const params = { lobbyId }
  return (
    <main id="main-content" className="lobby-page" tabIndex={-1}>
      {!lobby && <h1>Your dinner crew</h1>}
      {!lobby && !error && <p role="status">Loading lobby…</p>}
      {(error || actionError || invitationError) && <p role="alert">{actionError || error || invitationError}</p>}
      <p className="lobby-page__status" role="status">
        {connection !== 'Live' ? connection : ''}
      </p>
      {!lobby && error && (
        <TextAction to={paths.joinLobby}>Join with invitation code</TextAction>
      )}
      <p className="lobby-page__status" role="status">
        {notice}
      </p>
      {lobby && (
        <div className="lobby-page__columns">
          <section className="lobby-page__people" aria-label="Your dinner crew">
            <div className="lobby-page__title">
              <h1>{lobby.name}</h1>
            </div>
            <p className="lobby-page__intro">
              {lobby.status === 'waiting'
                ? 'Waiting for everyone to get ready.'
                : lobby.status === 'playing'
                  ? 'Your dinner round is in progress.'
                  : 'Your dinner round has finished.'}
            </p>
            <h2 className="lobby-section-heading">
              Members · {lobby.members.length}
            </h2>

            <ul className="lobby-members__list">
              {lobby.members.map((member) => (
                <li key={member.memberId} className="lobby-member">
                  <span className="lobby-avatar" aria-hidden="true">
                    {member.displayName
                      .trim()
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join('')
                      .toUpperCase()}
                  </span>

                  <div className="lobby-member__identity">
                    <strong>
                      {member.displayName}
                      {member.memberId === lobby.selfMemberId ? ' (you)' : ''}
                    </strong>
                    <p className="text-caption-default">
                      {member.memberId === lobby.hostMemberId ? 'Host · ' : ''}
                      {member.type === 'guest' ? 'Guest · ' : ''}
                      {member.online ? 'Online' : 'Offline'}
                    </p>
                  </div>
                  <span className="lobby-member__badge">
                    {member.online ? 'Online' : 'Offline'}
                  </span>
                </li>
              ))}
            </ul>
            {!lobby.members.length && (
              <p>Share your code to invite your crew.</p>
            )}
            <section
              className="lobby-chat-preview"
              aria-label="Recent group messages"
            >
              <ol
                className="lobby-chat-preview__messages"
                aria-live="polite"
                aria-relevant="additions"
              >
                {messages.slice(-3).map((message) => (
                  <li className="lobby-chat-preview__message" key={message.id}>
                    <span
                      className="lobby-avatar lobby-avatar--chat"
                      aria-hidden="true"
                    >
                      {message.senderName
                        .trim()
                        .split(/\s+/)
                        .map((part) => part[0])
                        .slice(0, 2)
                        .join('')
                        .toUpperCase()}
                    </span>
                    <div>
                      <p className="lobby-chat-preview__sender">
                        {message.senderName} ·{' '}
                        <time dateTime={message.createdAt}>
                          {new Date(message.createdAt).toLocaleTimeString([], {
                            hour: 'numeric',
                            minute: '2-digit',
                          })}
                        </time>
                      </p>
                      <p className="lobby-chat-preview__bubble">
                        {message.text}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              {!messages.length && (
                <p className="lobby-chat-preview__empty">
                  No messages yet. Say hello to your dinner crew.
                </p>
              )}
              <form
                className="lobby-chat-preview__composer"
                onSubmit={submitMessage}
              >
                <label
                  className="lobby-visually-hidden"
                  htmlFor="lobby-message"
                >
                  Message your dinner crew
                </label>
                <input
                  id="lobby-message"
                  className="lobby-chat-preview__draft"
                  maxLength={2000}
                  placeholder="Write a message…"
                  value={draft}
                  disabled={sending}
                  onChange={(event) => setDraft(event.target.value)}
                />
                <Button type="submit" disabled={sending || !draft.trim()}>
                  {sending ? 'Sending…' : 'Send'}
                </Button>
              </form>
            </section>
            <div className="lobby-controls-cards">

              <TextAction
                className="lobby-page__leave"
                disabled={busy}
                tone="danger"
                onClick={() => void mutate('/leave', {}, true)}
              >
                {busy ? 'Please wait…' : 'Leave lobby'}
              </TextAction>
              {lobby.isHost && (
                <TextAction
                  tone="danger"
                  disabled={busy}
                  onClick={() => void deleteLobby()}
                >
                  Close lobby for everyone
                </TextAction>
              )}
            </div>
            <GroupControls lobbyId={lobbyId} isHost={lobby.isHost} />
            <LobbyRestaurantPreview lobbyId={lobbyId} filterKey={JSON.stringify(lobby.filters)} isHost={lobby.isHost} />
          </section>

          <section className="lobby-page__settings" aria-label="Round settings">
            <LobbyCode code={lobby.lobbyCode} />
            {lobby.collectionSource && <p className="lobby-collection-source">Voting from collection: <strong>{lobby.collectionSource.name}</strong> · {lobby.collectionSource.count} restaurants. Discovery filters do not apply to this collection.</p>}
            <section
              className="lobby-round-filters"
              aria-labelledby="round-filters-heading"
            >
              <h2 id="round-filters-heading" className="lobby-section-heading">
                {editingFilters ? 'Edit lobby settings' : 'Round filters'}
              </h2>
              {!editingFilters && <>
                <p className="lobby-round-filters__summary">
                  {filters?.location || 'Any location'}
                  {filters?.dinnerAt &&
                    ` · ${new Date(filters.dinnerAt).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}`}{' '}
                  · within {filters?.maxDistance ?? 10} miles
                </p>
                <div className="lobby-filter-chips">
                  {[
                    ...(filters?.categories?.length
                      ? filters.categories
                      : ['Any cuisine']),
                    ...(filters?.priceLevels?.length
                      ? filters.priceLevels
                      : ['Any price']),
                    ...(filters?.minimumRating
                      ? [`${filters.minimumRating.toFixed(1)}+`]
                      : []),
                    ...(filters?.openNow ? ['Open now'] : []),
                    ...(filters?.diningNeeds ?? []),
                  ].map((label, index) => (
                    <span className="lobby-filter-tag" key={`${label}-${index}`}>
                      {label}
                    </span>
                  ))}
                </div>
              </>}
              {lobby.isHost && (
                <div className="lobby-round-filters__controls">
                  <TextAction
                    aria-expanded={editingFilters}
                    aria-controls="lobby-filter-editor"
                    onClick={() => setEditingFilters((current) => !current)}
                  >
                    {editingFilters ? 'Back to round filters' : 'Edit lobby settings & filters'}
                  </TextAction>
                </div>
              )}
              {lobby.isHost && editingFilters && (
                <div id="lobby-filter-editor" className="lobby-edit-panel">
                  <form key={`settings-${editorVersion}`} onSubmit={saveSettings} className="lobby-filter-editor">
                    <fieldset disabled={busy} className="lobby-filter-editor__group">
                      <TextInput label="Lobby name" name="name" required maxLength={120} defaultValue={lobby.name} />
                      <SelectField label="Status" name="status" defaultValue={lobby.status}>
                        <option value="waiting">Waiting</option>
                        <option value="playing">Playing</option>
                        <option value="finished">Finished</option>
                      </SelectField>
                    </fieldset>
                    <fieldset
                      disabled={busy}
                      className="lobby-filter-editor__group"
                    >
                      <div className="lobby-filter-editor__fields">
                        <TextInput
                          label="Location"
                          name="location"
                          required
                          maxLength={120}
                          defaultValue={filters?.location ?? ''}
                        />
                        <TextInput
                          label="New dinner date and time (optional)"
                          name="dinnerAt"
                          type="datetime-local"
                          hint="Leave blank to keep the current dinner time."
                        />
                        <TextInput
                          label="Maximum distance (miles)"
                          name="maxDistance"
                          type="number"
                          required
                          min={1}
                          max={100}
                          step="any"
                          defaultValue={filters?.maxDistance ?? 10}
                        />
                        <TextInput
                          label="Minimum rating"
                          name="minimumRating"
                          type="number"
                          required
                          min={0}
                          max={5}
                          step="0.1"
                          defaultValue={filters?.minimumRating ?? 0}
                        />
                        <TextInput
                          label="Cuisines (comma separated)"
                          name="categories"
                          defaultValue={filters?.categories?.join(', ') ?? ''}
                        />
                        <TextInput
                          label="Dining needs (comma separated)"
                          name="diningNeeds"
                          defaultValue={filters?.diningNeeds?.join(', ') ?? ''}
                        />
                      </div>
                      <fieldset className="lobby-filter-editor__group">
                        <legend>Price levels (none means any price)</legend>
                        {['$', '$$', '$$$'].map((price) => (
                          <label key={price}>
                            <input
                              type="checkbox"
                              name="priceLevels"
                              value={price}
                              defaultChecked={filters?.priceLevels?.includes(
                                price,
                              )}
                            />
                            {price}{' '}
                          </label>
                        ))}
                      </fieldset>
                      <label>
                        <input
                          type="checkbox"
                          name="openNow"
                          defaultChecked={filters?.openNow ?? false}
                        />{' '}
                        Open now
                      </label>
                      <Button type="submit">Save settings</Button>
                    </fieldset>
                  </form>
                </div>
              )}
            </section>
            <div className="lobby-actions lobby-page__navigation">
              <Button
                disabled={busy || (!lobby.isHost && !lobby.roundId)}
                onClick={() => lobby.roundId ? navigate(generatePath(paths.voting, params)) : void startGame()}
              >
                {lobby.roundId ? 'Return to game' : 'Start Game'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => navigate(generatePath(paths.groupChat, params))}
              >
                Open group chat
              </Button>
            </div>

          </section>
        </div>
      )}
    </main>
  )
}

export function LobbyPage() {
  const { lobbyId = '' } = useParams()
  return <LobbyScreen key={lobbyId} lobbyId={lobbyId} />
}
