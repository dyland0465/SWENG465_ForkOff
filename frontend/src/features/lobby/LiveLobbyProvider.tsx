import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { generatePath, useLocation, useMatch, useNavigate } from 'react-router'
import { paths } from '../../routes/paths'
import { io } from 'socket.io-client'
import { useAuth } from '../auth/useAuth'
import { LiveLobbyContext, lobbyRequest, mergeMessages } from './liveLobby'
import type { ChatMessage, LiveLobby } from './liveLobby'

export function LiveLobbyProvider({ children }: { children: ReactNode }) {
  const match = useMatch('/lobbies/:lobbyId/*')
  const id = match?.params.lobbyId
  const lobbyId = id && !['create', 'join'].includes(id) ? id : null
  return <LobbyConnection key={lobbyId ?? 'none'} lobbyId={lobbyId}>{children}</LobbyConnection>
}
function LobbyConnection({ lobbyId, children }: { lobbyId: string | null; children: ReactNode }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, loading } = useAuth()
  const [lobby, setLobby] = useState<LiveLobby | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [connection, setConnection] = useState('Connecting…')
  const refreshRef = useRef<() => void>(() => {})
  const previousHost = useRef<string | null | undefined>(undefined)
  const latestMessage = useRef<string | undefined>(undefined)
  const seenRound = useRef<string | null | undefined>(undefined)
  const base = `/api/lobbies/${encodeURIComponent(lobbyId ?? '')}`
  useEffect(() => { latestMessage.current = messages.at(-1)?.id }, [messages])
  useEffect(() => {
    if (!lobby || !lobbyId) return
    const previous = seenRound.current
    seenRound.current = lobby.roundId
    const inLobby = location.pathname === generatePath(paths.lobby, { lobbyId }) || location.pathname === generatePath(paths.groupChat, { lobbyId })
    if (lobby.roundId && previous !== lobby.roundId && (previous !== undefined || inLobby)) navigate(generatePath(paths.voting, { lobbyId }))
  }, [lobby, lobbyId, location.pathname, navigate])
  useEffect(() => {
    if (!lobbyId || loading) return
    let active = true
    let running = false
    let queued = false
    let historyLoaded = false
    let reconnectAnchor = latestMessage.current
    const socket = io({ autoConnect: false })
    async function reload() {
      queued = true
      if (running) return
      running = true
      while (queued && active) {
        queued = false
        try {
          const snapshot = await lobbyRequest<LiveLobby>(base)
          if (!active) break
          if (previousHost.current !== undefined && previousHost.current !== snapshot.hostMemberId) {
            const host = snapshot.members.find(member => member.memberId === snapshot.hostMemberId)
            setNotice(host ? `${host.displayName} is now the host.` : 'Waiting for an online member to become host.')
          }
          previousHost.current = snapshot.hostMemberId
          setLobby(current => current && current.revision > snapshot.revision ? current : snapshot); setError('')
        } catch (cause) {
          if (active) { setLobby(null); setError(cause instanceof Error ? cause.message : 'Could not load lobby.') }
        }
      }
      running = false
    }
    async function synchronizeHistory(latestKnown: string | undefined) {
      try {
        let cursor: string | null = null
        let first = true
        const collected: ChatMessage[] = []
        do {
          const page: { messages: ChatMessage[]; nextCursor: string | null } = await lobbyRequest(`${base}/messages${cursor ? `?before=${cursor}` : ''}`)
          if (!active) return
          collected.push(...page.messages)
          if (first && !historyLoaded) { setNextCursor(page.nextCursor); historyLoaded = true }
          first = false
          cursor = page.nextCursor
          if (!latestKnown || page.messages.some(message => message.id <= latestKnown)) break
        } while (cursor)
        setMessages(current => mergeMessages(current, collected))
      } catch (cause) { if (active) setError(cause instanceof Error ? cause.message : 'Could not load chat.') }
    }
    refreshRef.current = () => { void reload() }
    socket.on('connect', () => {
      socket.emit('lobby:subscribe', lobbyId, (result: { error?: string }) => {
        if (!active) return
        if (result.error) { setError(result.error); setConnection('Not connected'); return }
        setConnection('Live'); void reload(); void synchronizeHistory(reconnectAnchor)
      })
    })
    socket.on('lobby:changed', () => { void reload() })
    socket.on('chat:message', (message: ChatMessage) => setMessages(current => mergeMessages(current, [message])))
    socket.on('lobby:deleted', (event: { message: string }) => navigate('/', { replace: true, state: { lobbyNotice: event.message } }))
    socket.on('disconnect', reason => {
      reconnectAnchor = latestMessage.current
      setConnection(reason === 'io server disconnect' ? 'Session or membership ended. Rejoin to continue.' : 'Reconnecting…')
      if (reason === 'io server disconnect') { setLobby(null); setError('Your session or membership has ended. Rejoin with your current identity.') }
    })
    socket.on('connect_error', cause => { setConnection('Connection unavailable'); setError(cause.message) })
    void reload()
    socket.connect()
    return () => { active = false; refreshRef.current = () => {}; socket.removeAllListeners(); socket.disconnect() }
  }, [base, lobbyId, loading, user?.id, navigate])
  const refresh = useCallback(() => refreshRef.current(), [])
  async function mutate(path: string, method: string, body?: unknown) {
    const result = await lobbyRequest<{ lobby?: LiveLobby }>(base + path, method, body)
    if (path === '/leave' || method === 'DELETE') {
      navigate('/', { replace: true, state: { lobbyNotice: method === 'DELETE' ? 'Lobby deleted.' : 'You left the lobby.' } })
    } else {
      if (result.lobby) setLobby(current => current && current.revision > result.lobby!.revision ? current : result.lobby!)
      setNotice('Changes saved.'); refresh()
    }
  }
  async function sendMessage(text: string, requestId: string) {
    const result = await lobbyRequest<{ message: ChatMessage }>(`${base}/messages`, 'POST', { text, requestId })
    setMessages(current => mergeMessages(current, [result.message]))
  }
  async function loadOlder() {
    if (!nextCursor) return
    const page = await lobbyRequest<{ messages: ChatMessage[]; nextCursor: string | null }>(`${base}/messages?before=${nextCursor}`)
    setMessages(current => mergeMessages(current, page.messages)); setNextCursor(page.nextCursor)
  }
  return <LiveLobbyContext.Provider value={{ lobby, error, notice, connection, messages, nextCursor, refresh, mutate, sendMessage, loadOlder }}>{children}</LiveLobbyContext.Provider>
}
