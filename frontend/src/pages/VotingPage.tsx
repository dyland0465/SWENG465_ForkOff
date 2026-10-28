import { useState } from 'react'
import { generatePath, Navigate, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { useLiveLobby, lobbyRequest } from '../features/lobby/liveLobby'
import { useRound } from '../features/voting/useRound'
import type { Decision } from '../features/voting/useRound'
import { paths } from '../routes/paths'
import './VotingPage.css'

function VotingScreen({ lobbyId }: { lobbyId: string }) {
  const { lobby } = useLiveLobby()
  const { round, loading, error, refresh, base } = useRound(lobbyId)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const current = round?.restaurants.find(item => !round.decisions[item.id])
  const processed = round ? Object.keys(round.decisions).length : 0
  if (round?.complete) return <Navigate to={generatePath(paths.results, { lobbyId })} replace />
  async function start() {
    setBusy(true); setActionError('')
    try { await lobbyRequest(base, 'POST'); await refresh() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not start voting.') }
    finally { setBusy(false) }
  }
  async function vote(decision: Decision) {
    if (!round || !current || busy) return
    setBusy(true); setActionError('')
    try { await lobbyRequest(`${base}/vote`, 'PUT', { roundId: round.id, restaurantId: current.id, decision }); await refresh() }
    catch (cause) { setActionError(cause instanceof Error ? cause.message : 'Could not save your vote.') }
    finally { setBusy(false) }
  }
  return <main id="main-content" className="voting-page" tabIndex={-1}>
    <div className="voting-page__heading"><div><h1>Vote privately</h1><p className="voting-page__intro">Votes are revealed when everyone in the round finishes.</p></div>{round && <p>{processed} of {round.restaurants.length} reviewed</p>}</div>
    {(error || actionError) && <p role="alert">{actionError || error}</p>}
    {loading ? <p role="status">Loading voting round…</p> : !round ? <section className="voting-complete"><h2>No round started</h2><p>The host can start a round using restaurants near the lobby location.</p>{lobby?.isHost && <Button disabled={busy} onClick={start}>{busy ? 'Finding restaurants…' : 'Start voting'}</Button>}<TextAction to={generatePath(paths.lobby, { lobbyId })}>Back to lobby</TextAction></section> : !round.canVote ? <section className="voting-complete"><h2>Round already in progress</h2><p>You joined after this round started. Results will appear when everyone finishes.</p></section> : current ? <div className="voting-page__columns"><div className="voting-page__visual">{current.photoUrl ? <img className="voting-photo" src={current.photoUrl} alt={`Photo of ${current.name}`} /> : <div className="discovery-restaurant__photo-placeholder">Photo unavailable</div>}{current.photoAuthors.map((author, index) => <small key={index}> Photo: {author.uri ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName}</a> : author.displayName}</small>)}<p>Restaurant information from Google Maps</p></div><section className="voting-card"><h2>{current.name}</h2><p className="voting-card__meta">{current.category?.replace(/_/g, ' ') ?? 'Restaurant'} · {current.address ?? 'Address unavailable'}</p>{current.googleMapsUri && <p><a href={current.googleMapsUri} target="_blank" rel="noreferrer">View on Google Maps</a></p>}<div className="voting-controls" role="group" aria-label={`Vote on ${current.name}`}>{(['yes', 'no', 'veto', 'skip'] as const).map(choice => <Button key={choice} disabled={busy} className={`voting-choice voting-choice--${choice}`} onClick={() => void vote(choice)}>{choice.toUpperCase()}</Button>)}</div><p className="voting-card__privacy">Your choices stay private until everyone finishes.</p></section></div> : <section className="voting-complete" role="status"><h2>Waiting for the group</h2><p>You've finished voting. {round.completed} of {round.totalMembers} members finished.</p><p>Results will appear automatically when everyone finishes.</p></section>}
  </main>
}
export function VotingPage() { const { lobbyId } = useParams<'lobbyId'>(); return lobbyId ? <VotingScreen key={lobbyId} lobbyId={lobbyId} /> : <main id="main-content">Lobby unavailable.</main> }
