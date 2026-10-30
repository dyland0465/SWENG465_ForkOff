import { GoogleMapsLink } from '../components/ui/GoogleMapsLink'
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
    {loading ? <p role="status">Loading results…</p> : !round ? <p>No voting round has started.</p> : !round.complete ? <section className="results-incomplete"><p>Waiting for the group: {round.completed} of {round.totalMembers} members finished. Votes remain private until everyone finishes.</p>{round.canVote && <TextAction to={generatePath(paths.voting, { lobbyId })}>Continue voting →</TextAction>}</section> : <ResultsList results={round.results ?? []} />}

    <footer className="results-footer"><TextAction className="results-lobby" to={generatePath(paths.lobby, { lobbyId })}>Return to lobby</TextAction>{lobby?.isHost && round && <Button disabled={busy} variant="secondary" onClick={() => void reset()}>End round</Button>}</footer>
  </main>
}
type Result = NonNullable<NonNullable<ReturnType<typeof useRound>['round']>['results']>[number]

function ResultDetails({ row }: { row: Result }) {
  const { restaurant, yes, no, veto, skip } = row
  return <>
    <h3>{restaurant.name}</h3>
    <p>{restaurant.category?.replace(/_/g, ' ') ?? 'Restaurant'} · {restaurant.address ?? 'Address unavailable'}</p>
    <p>{yes} yes · {no} no · {veto} veto · {skip} skipped {veto > 0 && '· Vetoed'}</p>
    {restaurant.googleMapsUri && <GoogleMapsLink href={restaurant.googleMapsUri} />}
    {restaurant.photoAuthors.map((author, i) => <small key={i}> Photo: {author.uri ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName}</a> : author.displayName}</small>)}
  </>
}

function ResultsList({ results }: { results: Result[] }) {
  const eligible = results.filter(row => !row.veto)
  const top = eligible.slice(0, 3)
  const rest = [...eligible.slice(3), ...results.filter(row => row.veto)]
  return <section className="results-ranking">
    <h2>Top restaurants</h2>
    <p className="results-ranking__note">Ranked by yes votes. Ties follow the restaurant list order; vetoed restaurants are excluded from the podium.</p>
    {top.length ? <ol className="results-podium">{top.map((row, index) => <li key={row.restaurant.id} className={`results-podium__place results-podium__place--${index + 1}`}>
      <span className="results-podium__rank">#{index + 1}</span>
      {row.restaurant.photoUrl && <img src={row.restaurant.photoUrl} alt="" />}
      <div><ResultDetails row={row} /></div>
    </li>)}</ol> : <p>No restaurants are eligible for the podium because every restaurant was vetoed.</p>}
    {rest.length > 0 && <><h2>More results</h2><ol className="results-list">{rest.map((row, index) => <li key={row.restaurant.id} className="results-row">
      <span className="results-row__rank">{row.veto ? '–' : index + 4}</span>
      {row.restaurant.photoUrl && <img className="results-row__photo" src={row.restaurant.photoUrl} alt="" />}
      <div className="results-row__copy"><ResultDetails row={row} /></div>
    </li>)}</ol></>}
    <p className="results-ranking__note">Restaurant information from Google Maps.</p>
  </section>
}
export function ResultsPage() { const { lobbyId } = useParams<'lobbyId'>(); return lobbyId ? <ResultsScreen key={lobbyId} lobbyId={lobbyId} /> : <main id="main-content">Lobby unavailable.</main> }
