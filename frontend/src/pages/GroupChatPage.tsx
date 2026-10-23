import { useEffect, useRef, useState } from 'react'
import type { FormEvent, KeyboardEvent } from 'react'
import { generatePath, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { useLiveLobby } from '../features/lobby/liveLobby'
import { paths } from '../routes/paths'
import './LobbyPage.css'
import './GroupChatPage.css'

export function GroupChatPage() {
  const { lobbyId = '' } = useParams()
  const { lobby, messages, nextCursor, sendMessage, loadOlder, error, notice, connection } = useLiveLobby()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [sendError, setSendError] = useState('')
  const pending = useRef<{ text: string; requestId: string } | null>(null)
  const historyRef = useRef<HTMLDivElement>(null)
  const scrollBack = useRef<{ height: number; top: number } | null>(null)
  const nearBottom = useRef(true)
  useEffect(() => {
    const history = historyRef.current
    if (!history) return
    if (scrollBack.current) {
      history.scrollTop = scrollBack.current.top + history.scrollHeight - scrollBack.current.height
      scrollBack.current = null
    } else if (nearBottom.current) history.scrollTop = history.scrollHeight
  }, [messages])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy || !draft.trim() || !lobby) return
    const text = draft.trim()
    const request = pending.current?.text === text ? pending.current : { text, requestId: crypto.randomUUID() }
    pending.current = request
    setBusy(true); setSendError('')
    try {
      await sendMessage(request.text, request.requestId)
      setDraft(''); pending.current = null; nearBottom.current = true
    } catch (cause) { setSendError(cause instanceof Error ? cause.message : 'Message was not sent. Retry to send it once.') }
    finally { setBusy(false) }
  }
  async function older() {
    setLoadingOlder(true); setSendError('')
    const history = historyRef.current
    if (history) scrollBack.current = { height: history.scrollHeight, top: history.scrollTop }
    try { await loadOlder() }
    catch (cause) { scrollBack.current = null; setSendError(cause instanceof Error ? cause.message : 'Could not load older messages.') }
    finally { setLoadingOlder(false) }
  }
  function onKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault(); event.currentTarget.form?.requestSubmit()
    }
  }
  return (
    <main id="main-content" className="group-chat-page" tabIndex={-1}>
      <div className="group-chat-page__heading">
        <div><h1>Group chat</h1><p>{lobby?.name ?? 'Your dinner crew'} · {connection}</p></div>
        <TextAction to={generatePath(paths.lobby, { lobbyId })}>Back to lobby</TextAction>
      </div>
      {(error || sendError) && <p role="alert">{sendError || error}</p>}
      <p role="status">{notice}</p>
      {!lobby && <TextAction to={paths.joinLobby}>Join with invitation code</TextAction>}
      {lobby && <div className="group-chat-page__columns">
        <div className="group-chat-page__conversation-column">
          <section className="group-chat-conversation" aria-label="Group conversation">
            {nextCursor && <TextAction disabled={loadingOlder} onClick={() => void older()}>{loadingOlder ? 'Loading…' : 'Load older messages'}</TextAction>}
            <div ref={historyRef} className="group-chat-history" role="log" aria-label="Message history" aria-live="polite" aria-relevant="additions" tabIndex={0}
              onScroll={event => { const element = event.currentTarget; nearBottom.current = element.scrollHeight - element.scrollTop - element.clientHeight < 80 }}>
              {messages.length ? <ol className="group-chat-history__list">
                {messages.map(message => <li key={message.id} className={`group-chat-message${message.memberId === lobby.selfMemberId ? ' group-chat-message--local' : ''}`}>
                  <span className="lobby-avatar lobby-avatar--chat" aria-hidden="true">{message.senderName.slice(0, 2).toUpperCase()}</span>
                  <div className="group-chat-message__content">
                    <p className="group-chat-message__sender">{message.senderName} · <time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time></p>
                    <p className="group-chat-message__bubble">{message.text}</p>
                  </div>
                </li>)}
              </ol> : <div className="group-chat-history__empty"><h2>No messages yet</h2><p>Say hello to your dinner crew.</p></div>}
            </div>
            <form className="group-chat-composer" onSubmit={submit}>
              <textarea id="group-chat-message" name="message" rows={2} maxLength={2000} placeholder="Write a message…" value={draft} disabled={busy} onChange={event => setDraft(event.target.value)} onKeyDown={onKeyDown} aria-describedby="group-chat-composer-help" />
              <Button type="submit" disabled={busy || !draft.trim()}>{busy ? 'Sending…' : sendError ? 'Retry send' : 'Send'}</Button>
            </form>
          </section>
          <p id="group-chat-composer-help"><label htmlFor="group-chat-message">Message.</label> Enter to send · Shift+Enter for a new line · 2,000 characters maximum.</p>
        </div>
        <aside className="group-chat-people" aria-labelledby="group-chat-people-heading">
          <h2 id="group-chat-people-heading">Members · {lobby.members.filter(member => member.online).length} online</h2>
          <ul className="group-chat-people__list">
            {lobby.members.map(member => <li key={member.memberId} className="lobby-member">
              <span className="lobby-avatar" aria-hidden="true">{member.displayName.slice(0, 2).toUpperCase()}</span>
              <div><strong>{member.displayName}{member.memberId === lobby.selfMemberId ? ' (you)' : ''}</strong>
                <p>{member.memberId === lobby.hostMemberId ? 'Host · ' : ''}{member.online ? 'Online' : 'Offline'}</p></div>
            </li>)}
          </ul>
        </aside>
      </div>}
    </main>
  )
}
