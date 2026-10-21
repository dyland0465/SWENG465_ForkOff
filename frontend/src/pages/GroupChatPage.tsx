import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { generatePath, useParams } from 'react-router'
import { PlayerCard } from '../components/lobby/PlayerCard'
import type { LobbyMember } from '../components/lobby/PlayerCard'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import './LobbyPage.css'
import './GroupChatPage.css'

type ChatMessage = {
  id: string
  sender: string
  initials: string
  text: string
  time: string
  dateTime: string
  local?: boolean
}

// Figma fixtures, never messages, presence, or results fetched for the route ID.
const demoMessages: readonly ChatMessage[] = [
  { id: 'demo-avery', sender: 'Avery Chen', initials: 'AC', text: 'Ramen sounds perfect tonight.', time: '7:42 PM', dateTime: '19:42' },
  { id: 'demo-jordan', sender: 'Jordan Reed', initials: 'JR', text: 'I’m good with the top three—no spoilers yet.', time: '7:43 PM', dateTime: '19:43' },
  { id: 'demo-maya', sender: 'Maya Singh', initials: 'MS', text: 'Copper Bowl has great mocktails.', time: '7:44 PM', dateTime: '19:44' },
]

const demoMembers: readonly LobbyMember[] = [
  { name: 'Jordan Reed', initials: 'JR', role: 'Leader · online', ready: true },
  { name: 'Avery Chen', initials: 'AC', role: 'Online', ready: true },
  { name: 'Maya Singh', initials: 'MS', role: 'Online', ready: true },
  { name: 'Sam Kim', initials: 'SK', role: 'Online', ready: true },
]

function GroupChatScreen({ lobbyId }: { lobbyId: string }) {
  const [messages, setMessages] = useState<readonly ChatMessage[]>(demoMessages)
  const [draft, setDraft] = useState('')
  const [status, setStatus] = useState('')
  const historyRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const nextId = useRef(0)
  const routeParams = { lobbyId }

  // Resize only the composer, and scroll only the history, without moving the page.
  useLayoutEffect(() => {
    const input = inputRef.current
    if (input) {
      input.style.height = 'auto'
      input.style.height = `${input.scrollHeight}px`
    }
  }, [draft])

  useEffect(() => {
    const history = historyRef.current
    if (history) history.scrollTop = history.scrollHeight
  }, [messages])

  function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const text = draft.trim()
    if (!text) return

    const now = new Date()
    const message: ChatMessage = {
      id: `local-${nextId.current++}`,
      sender: 'You',
      initials: 'YO',
      text,
      time: now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
      dateTime: now.toISOString(),
      local: true,
    }
    setMessages(previous => [...previous, message])
    setDraft('')
    setStatus('Message added locally. It has not been sent to anyone or saved.')
    inputRef.current?.focus({ preventScroll: true })
  }

  function onComposerKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  return (
    <main id="main-content" className="group-chat-page" tabIndex={-1}>
      <div className="group-chat-page__heading">
        <div>
          <h1>Group chat</h1>
          <p className="group-chat-page__intro">Friday Food Crew · 4 members online <span className="group-chat-page__sample">(demo)</span></p>
        </div>
        <TextAction className="ui-button ui-button--secondary group-chat-page__back" to={generatePath(paths.lobby, routeParams)}>Back to lobby</TextAction>
      </div>

      <div className="group-chat-page__columns">
        <div className="group-chat-page__conversation-column">
          <section className="group-chat-conversation" aria-label="Group conversation (temporary demo)">
            <div ref={historyRef} className="group-chat-history" role="log" aria-label="Message history" aria-live="polite" aria-relevant="additions" tabIndex={0}>
              {messages.length ? (
                <ol className="group-chat-history__list">
                  {messages.map(message => (
                    <li key={message.id} className={`group-chat-message${message.local ? ' group-chat-message--local' : ''}`}>
                      <span className="lobby-avatar lobby-avatar--chat" aria-hidden="true">{message.initials}</span>
                      <div className="group-chat-message__content">
                        <p className="group-chat-message__sender">
                          {message.sender} · <time dateTime={message.dateTime}>{message.time}</time>
                          <span className="group-chat-message__source">{message.local ? 'Local · unsaved' : 'Demo'}</span>
                        </p>
                        <p className="group-chat-message__bubble">{message.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="group-chat-history__empty">
                  <h2>No messages here yet</h2>
                  <p>Write a message to start a temporary conversation. Only you can see it.</p>
                </div>
              )}
            </div>

            <p className="group-chat-conversation__round">Voting complete · results are ready <span className="group-chat-page__sample">(demo)</span></p>
            <div className="group-chat-result" aria-label="Sample voting result">
              <div>
                <h2>Top match: North Pier Ramen</h2>
                <p>89% approval · 8 yes · 1 no · 0 veto</p>
              </div>
              <TextAction tone="on-dark" to={generatePath(paths.results, routeParams)} aria-label="View results (placeholder)">View results →</TextAction>
            </div>

            <form className="group-chat-composer" onSubmit={sendMessage}>
              <textarea ref={inputRef} id="group-chat-message" name="message" rows={1} maxLength={2000} placeholder="Write a message…" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={onComposerKeyDown} aria-describedby="group-chat-composer-help group-chat-demo-note" />
              <Button type="submit" disabled={!draft.trim()} aria-label="Send message (local only)">Send</Button>
            </form>
          </section>
          <div className="group-chat-page__help">
            <p id="group-chat-composer-help"><label htmlFor="group-chat-message">Message (local only).</label> Enter to send · Shift+Enter for a new line · 2,000 characters maximum.</p>
            <p className="group-chat-page__status" role="status">{status}</p>
          </div>
        </div>

        <aside className="group-chat-people" aria-labelledby="group-chat-people-heading">
          <h2 id="group-chat-people-heading">People here</h2>
          <ul className="group-chat-people__list" aria-label="Sample lobby members">
            {demoMembers.map(member => <PlayerCard key={member.name} {...member} />)}
          </ul>
          <section className="group-chat-activity" aria-labelledby="group-chat-activity-heading">
            <h3 id="group-chat-activity-heading">Lobby activity</h3>
            <ul aria-label="Demonstration activity">
              <li><time dateTime="19:39">7:39 PM</time> · Sam joined</li>
              <li><time dateTime="19:41">7:41 PM</time> · Voting started</li>
              <li><time dateTime="19:45">7:45 PM</time> · Results revealed</li>
            </ul>
          </section>
        </aside>
      </div>

      <aside className="lobby-demo-note" aria-label="Demonstration details">
        <p id="group-chat-demo-note"><strong>Temporary, unsaved preview.</strong> Demo messages, members, online statuses, results, and activity are sample data. Route ID: <span className="lobby-demo-note__id">{lobbyId}</span>; no lobby has been loaded. Your messages are visible only here, never sent or saved, and clear when you leave, refresh, or change lobby IDs. View results opens a placeholder.</p>
        <TextAction className="group-chat-page__clear" disabled={!messages.length} onClick={() => { setMessages([]); setStatus('Temporary conversation cleared. Nothing was deleted from a server.') }}>Clear temporary conversation</TextAction>
      </aside>
    </main>
  )
}

export function GroupChatPage() {
  const { lobbyId } = useParams<'lobbyId'>()
  if (!lobbyId?.trim() || lobbyId.startsWith(':')) {
    return (
      <main id="main-content" className="route-placeholder" tabIndex={-1}>
        <h1 className="text-heading-h1">Lobby ID unavailable</h1>
        <p className="text-body-large">Open a lobby link with its ID to view this conversation.</p>
        <TextAction to={paths.joinLobby}>Enter lobby code</TextAction>
      </main>
    )
  }
  return <GroupChatScreen key={lobbyId} lobbyId={lobbyId} />
}
