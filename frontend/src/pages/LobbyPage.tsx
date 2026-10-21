import { useEffect, useState } from 'react'
import { generatePath, useParams } from 'react-router'
import { LobbyCode } from '../components/lobby/LobbyCode'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import './LobbyPage.css'

type Lobby = {
  id: string; name: string; lobbyCode: string; status: string
  members: { _id: string; username: string }[]
  guestMembers: { guestId: string; displayName: string }[]
  filters?: { location?: string; dinnerAt?: string; maxDistance?: number; minimumRating?: number; categories?: string[]; priceLevels?: string[]; diningNeeds?: string[] }
}

function LobbyScreen({ lobbyId }: { lobbyId: string }) {
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch(`/api/lobbies/${encodeURIComponent(lobbyId)}`, { signal: controller.signal })
        const data = await response.json()
        if (!response.ok) throw new Error(data.message || 'Could not load lobby.')
        if (!controller.signal.aborted) setLobby(data)
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load lobby.')
      }
    }
    void load()
    return () => controller.abort()
  }, [lobbyId, attempt])
  const filters = lobby?.filters
  const params = { lobbyId }
  return (
    <main id="main-content" className="lobby-page" tabIndex={-1}>
      <h1>{lobby?.name ?? 'Your dinner crew'}</h1>
      {!lobby && !error && <p role="status">Loading lobby…</p>}
      {error && <p role="alert">{error}</p>}
      <TextAction onClick={() => { setLobby(null); setError(''); setAttempt(value => value + 1) }}>Refresh lobby</TextAction>
      {lobby && <div className="lobby-page__columns">
        <section>
          <h2>Members</h2>
          <ul>
            {lobby.members.map(member => <li key={member._id}>{member.username}</li>)}
            {lobby.guestMembers.map(member => <li key={member.guestId}>{member.displayName} · Guest</li>)}
          </ul>
          {!lobby.members.length && !lobby.guestMembers.length && <p>Share your code to invite your crew.</p>}
          <p>Lobby status: {lobby.status}</p>
        </section>
        <section>
          <LobbyCode code={lobby.lobbyCode} />
          <h2>Round filters</h2>
          <p>{filters?.location} {filters?.dinnerAt && `· ${new Date(filters.dinnerAt).toLocaleString()}`}</p>
          <p>Within {filters?.maxDistance ?? 10} miles · Minimum rating: {filters?.minimumRating || 'Any'}</p>
          <p>{filters?.categories?.join(', ') || 'Any cuisine'} · {filters?.priceLevels?.join(', ') || 'Any price'}</p>
          <p>{filters?.diningNeeds?.join(', ')}</p>
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
