import { useState } from 'react'
import { generatePath, useNavigate, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { lobbyRequest, useLiveLobby } from '../features/lobby/liveLobby'
import { useRound } from '../features/voting/useRound'
import { paths } from '../routes/paths'
import './ResultsPage.css'

function ResultsScreen({ lobbyId }: { lobbyId: string }) {
  const { round, loading, error, base } = useRound(lobbyId)
  const { lobby } = useLiveLobby()
  const navigate = useNavigate()
  const [actionError, setActionError] = useState('')
  const [busy, setBusy] = useState(false)
  async function reset() {
    if (!window.confirm('End this round and clear its votes?')) return
    setBusy(true); setActionError('')
    try { await lobbyRequest(base, 'DELETE'); navigate(generatePath(paths.voting, { lobbyId })) }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not end the round.') }
    finally { setBusy(false) }
  }
  return <main id="main-content" className="results-page" tabIndex={-1}>
    <header className="results-page__heading"><div><h1>Group results</h1><p className="results-page__intro">Restaurants are ranked by yes votes; vetoed restaurants are listed last.</p></div></header>
    {(error || actionError) && <p role="alert">{actionError || error}</p>}
    {loading ? <p role="status">Loading results…</p> : !round ? <p>No voting round has started.</p> : !round.complete ? <section className="results-incomplete"><p>Waiting for the group: {round.completed} of {round.totalMembers} members finished. Votes remain private until everyone finishes.</p>{round.canVote && <TextAction to={generatePath(paths.voting, { lobbyId })}>Continue voting →</TextAction>}</section> : <section className="results-ranking"><h2>Restaurant ranking</h2><ol className="results-list">{round.results?.map(({ restaurant, yes, no, veto, skip }, index) => <li key={restaurant.id} className="results-row"><span className="results-row__rank">{veto ? '–' : index + 1}</span>{restaurant.photoUrl && <img className="results-row__photo" src={restaurant.photoUrl} alt="" />}<div className="results-row__copy"><h3>{restaurant.name}</h3><p>{restaurant.category?.replace(/_/g, ' ') ?? 'Restaurant'} · {restaurant.address ?? 'Address unavailable'}</p><p>{yes} yes · {no} no · {veto} veto · {skip} skipped {veto > 0 && '· Vetoed'}</p>{restaurant.googleMapsUri && <a href={restaurant.googleMapsUri} target="_blank" rel="noreferrer">View on Google Maps</a>}{restaurant.photoAuthors.map((author, i) => <small key={i}> Photo: {author.uri ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName}</a> : author.displayName}</small>)}</div></li>)}</ol><p>Restaurant information from Google Maps. A veto excludes a restaurant from the ranking.</p></section>}
    <footer className="results-footer"><TextAction className="results-lobby" to={generatePath(paths.lobby, { lobbyId })}>Return to lobby</TextAction>{lobby?.isHost && round && <Button disabled={busy} variant="secondary" onClick={() => void reset()}>End round</Button>}</footer>
  </main>
}
export function ResultsPage() { const { lobbyId } = useParams<'lobbyId'>(); return lobbyId ? <ResultsScreen key={lobbyId} lobbyId={lobbyId} /> : <main id="main-content">Lobby unavailable.</main> }
