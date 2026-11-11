import { SaveRestaurant } from '../features/saved/SaveRestaurant'
import { GoogleMapsLink } from '../components/ui/GoogleMapsLink'
import { useEffect, useState } from 'react'
import { generatePath, Navigate, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { useLiveLobby, lobbyRequest } from '../features/lobby/liveLobby'
import { useRound } from '../features/voting/useRound'
import { PartnerBadge } from '../features/voting/partnerBadge'
import type { Decision } from '../features/voting/useRound'
import { engagementId } from '../features/voting/engagement'
import { paths } from '../routes/paths'
import './VotingPage.css'


function hoursForToday(hours: string[] | undefined, timeZone?: string | null) {
  if (!hours?.length) return null
  let weekday: string
  try {
    weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long', ...(timeZone ? { timeZone } : {}) }).format(new Date())
  } catch {
    weekday = new Intl.DateTimeFormat('en-US', { weekday: 'long' }).format(new Date())
  }
  const entry = hours.find(day => day.toLowerCase().startsWith(`${weekday.toLowerCase()}:`))
  return entry ? entry.slice(entry.indexOf(':') + 1).trim() : null
}

function VotingScreen({ lobbyId }: { lobbyId: string }) {
  const { lobby } = useLiveLobby()
  const { round, loading, error, refresh, base } = useRound(lobbyId)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [images, setImages] = useState<{ roundId: string; urls: Record<string, string> } | null>(null)
  const roundId = round?.id
  useEffect(() => {
    if (!roundId || !round) return
    const controller = new AbortController()
    const urls: string[] = []
    void Promise.all(round.restaurants.map(async restaurant => {
      if (!restaurant.photoUrl) return [restaurant.id, ''] as const
      try {
        const response = await fetch(restaurant.photoUrl, { signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]) })
        if (!response.ok) return [restaurant.id, ''] as const
        const url = URL.createObjectURL(await response.blob())
        if (controller.signal.aborted) { URL.revokeObjectURL(url); return [restaurant.id, ''] as const }
        urls.push(url)
        return [restaurant.id, url] as const
      } catch { return [restaurant.id, ''] as const }
    })).then(entries => { if (!controller.signal.aborted) setImages({ roundId, urls: Object.fromEntries(entries) }) })
    return () => { controller.abort(); urls.forEach(url => URL.revokeObjectURL(url)) }
  // Restaurant images are immutable within a round.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId])
  const current = round?.restaurants.find(item => !round.decisions[item.id])
  const processed = round ? Object.keys(round.decisions).length : 0
  const currentId = current?.id
  const canTrackView = Boolean(round?.canVote && !round.complete && images?.roundId === round.id)
  useEffect(() => {
    if (!roundId || !currentId || !canTrackView) return
    void lobbyRequest(`${base}/engagement`, 'POST', { roundId, restaurantId: currentId, kind: 'card_view' }).catch(() => {})
  }, [base, roundId, currentId, canTrackView])
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
    {round?.warnings?.map(warning => <p key={warning}>{warning}</p>)}
    {loading ? <p role="status">Loading voting round…</p> : !round ? <section className="voting-complete"><h2>No round started</h2><p>The host can start a round using restaurants near the lobby location.</p>{lobby?.isHost && <Button disabled={busy} onClick={start}>{busy ? 'Finding restaurants…' : 'Start voting'}</Button>}<TextAction to={generatePath(paths.lobby, { lobbyId })}>Back to lobby</TextAction></section> : !round.canVote ? <section className="voting-complete"><h2>Round already in progress</h2><p>You joined after this round started. Results will appear when everyone finishes.</p></section> : current && images?.roundId !== round.id ? <p role="status">Loading restaurant photos before voting…</p> : current ? <div className="voting-page__columns"><div className="voting-page__visual">{images?.urls[current.id] ? <img className="voting-photo" src={images.urls[current.id]} alt={`Photo of ${current.name}`} /> : <div className="discovery-restaurant__photo-placeholder">Photo unavailable</div>}<div className="voting-page__photo-credit">{current.photoAuthors.length > 0 && <p>Photo: {current.photoAuthors.map((author, index) => <span key={index}>{index > 0 && ', '}{author.uri ? <a href={author.uri} target="_blank" rel="noreferrer">{author.displayName}</a> : author.displayName}</span>)}</p>}<p>Restaurant information from Google Maps</p></div></div><section className="voting-card" aria-label={`Vote on ${current.name}`}>
      <div className="voting-card__heading">
        <p className="voting-card__eyebrow">YOUR NEXT OPTION</p>
        <h2>{current.name}</h2>
        <p className="voting-card__category">{current.category?.replace(/_/g, ' ') ?? 'Restaurant'}</p>
          {current.partner && <PartnerBadge />}
      </div>
      <div className="voting-card__facts" aria-label="Restaurant details">
        <div><span>RATING</span><strong>{current.rating != null ? `★ ${current.rating} / 5` : 'Not available'}</strong>{current.rating != null && current.ratingCount != null && <small>{current.ratingCount.toLocaleString()} reviews</small>}</div>
        <div><span>PRICE</span><strong>{({ PRICE_LEVEL_INEXPENSIVE: '$', PRICE_LEVEL_MODERATE: '$$', PRICE_LEVEL_EXPENSIVE: '$$$', PRICE_LEVEL_VERY_EXPENSIVE: '$$$$' } as Record<string, string>)[current.priceLevel ?? ''] ?? 'Not available'}</strong></div>
        <div><span>DISTANCE</span><strong>{current.distanceMiles != null ? `${current.distanceMiles} mi` : 'Not available'}</strong></div>
      </div>
      <div className="voting-card__visit">
        <div><span>LOCATION</span><p>{current.address ?? 'Address unavailable'}</p></div>
        <div><span>TODAY’S HOURS</span><p>{hoursForToday(current.hours, current.timeZone) ?? 'Hours unavailable'}</p>{hoursForToday(current.hours, current.timeZone) && <small>Regular hours may vary.</small>}</div>
        {current.googleMapsUri && <div className="voting-card__map"><GoogleMapsLink href={current.googleMapsUri} onClick={() => { if (round) void lobbyRequest(`${base}/engagement`, 'POST', { roundId: round.id, restaurantId: current.id, kind: 'maps_click', eventId: engagementId() }).catch(() => {}) }} /></div>}
      </div>
            {current.partner && (current.partner.website || current.partner.phone || !!current.partner.serviceOptions?.length) && <div className="voting-card__partner">
        <span>FROM THE RESTAURANT</span>
        {!!current.partner.serviceOptions?.length && <p>{current.partner.serviceOptions.join(' · ')}</p>}
        {(current.partner.website || current.partner.phone) && <p>
          {current.partner.website && <a href={current.partner.website} target="_blank" rel="noopener noreferrer nofollow">Website</a>}
          {current.partner.website && current.partner.phone && ' · '}
          {current.partner.phone && <a href={`tel:${current.partner.phone.replace(/[^\d+]/g, '')}`}>{current.partner.phone}</a>}
        </p>}
      </div>}
      <SaveRestaurant key={current.id} placeId={current.id} />
      <div className="voting-card__vote">
        <h3>What do you think?</h3>
        <p>Make your pick for this restaurant.</p>
        <div className="voting-controls" role="group" aria-label={`Vote on ${current.name}`}>{(['yes', 'no', 'veto', 'skip'] as const).map(choice => <Button key={choice} disabled={busy} className={`voting-choice voting-choice--${choice}`} onClick={() => void vote(choice)}>{choice.toUpperCase()}</Button>)}</div>
        <p className="voting-card__privacy">Your choices stay private until everyone finishes.</p>
      </div>
    </section></div> : <section className="voting-complete" role="status"><h2>Waiting for the group</h2><p>You've finished voting. {round.completed} of {round.totalMembers} members finished.</p><p>Results will appear automatically when everyone finishes.</p></section>}
  </main>
}
export function VotingPage() { const { lobbyId } = useParams<'lobbyId'>(); return lobbyId ? <VotingScreen key={lobbyId} lobbyId={lobbyId} /> : <main id="main-content">Lobby unavailable.</main> }
