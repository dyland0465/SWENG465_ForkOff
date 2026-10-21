import { useEffect, useRef, useState } from 'react'
import { generatePath, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { ProgressIndicator } from '../components/ui/ProgressIndicator'
import { TextAction } from '../components/ui/TextAction'
import { votingRestaurants } from '../data/demoRestaurants'
import { useVotingSession } from '../features/voting/useVotingSession'
import { getRecordedVotes } from '../features/voting/votingSession'
import type { VotingDecision } from '../features/voting/votingSession'
import undoIcon from '../assets/figma/voting/undo.png'
import { paths } from '../routes/paths'
import '../components/ui/FilterChip.css'
import './VotingPage.css'

const shortcutDecisions: Record<string, VotingDecision> = { y: 'yes', n: 'no', v: 'veto' }

function VotingScreen({ lobbyId }: { lobbyId: string }) {
  const { session, dispatch } = useVotingSession(lobbyId)
  const [shortcutsEnabled, setShortcutsEnabled] = useState(true)
  const mainRef = useRef<HTMLElement>(null)
  const completedRef = useRef<HTMLHeadingElement>(null)
  const wasComplete = useRef(false)
  const processed = session.history.length
  const current = votingRestaurants[processed]
  const complete = processed === votingRestaurants.length
  const votes = getRecordedVotes(session)
  const skipped = processed - votes.length
  const routeParams = { lobbyId }

  function processDecision(decision: VotingDecision) {
    if (current) dispatch({ type: 'process', restaurantId: current.id, decision })
  }

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target
      if (!shortcutsEnabled || event.repeat || event.isComposing || event.ctrlKey || event.altKey || event.metaKey
        || document.querySelector('dialog[open]') || !(target instanceof HTMLElement)
        || target.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])')
        || (target !== document.body && !mainRef.current?.contains(target))) return
      const key = event.key.toLowerCase()
      if (key === 'u' && processed) {
        event.preventDefault()
        dispatch({ type: 'undo' })
      } else if (current && Object.hasOwn(shortcutDecisions, key)) {
        event.preventDefault()
        processDecision(shortcutDecisions[key])
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  useEffect(() => {
    if (complete) completedRef.current?.focus({ preventScroll: true })
    else if (wasComplete.current) mainRef.current?.querySelector<HTMLElement>('#voting-restaurant-heading')?.focus({ preventScroll: true })
    wasComplete.current = complete
  }, [complete])

  const feedback = session.feedback
  let status = ''
  if (feedback?.kind === 'restarted') status = 'Demo restarted. All local choices cleared.'
  else if (feedback) {
    const name = votingRestaurants.find(restaurant => restaurant.id === feedback.entry.restaurantId)?.name
    const choice = feedback.entry.decision
    status = feedback.kind === 'undone'
      ? `Undid ${choice === 'skip' ? 'skip' : choice.toUpperCase()} for ${name}. Its previous choice has been removed.`
      : choice === 'skip' ? `Skipped ${name}. No vote recorded.` : `${choice.toUpperCase()} recorded locally for ${name}.`
  }
  if (status) status += complete ? ' Demo complete; choices saved in this tab only.' : ` ${processed} of ${votingRestaurants.length} processed. Now showing ${current.name}.`

  const undoControl = (
    <TextAction className="voting-undo" disabled={!processed} onClick={() => dispatch({ type: 'undo' })} aria-keyshortcuts={shortcutsEnabled ? 'U' : undefined}>
      <img src={undoIcon} width="17" height="17" alt="" />
      Undo last {session.history.at(-1)?.decision === 'skip' ? 'skip' : 'vote'}
    </TextAction>
  )

  return (
    <main ref={mainRef} id="main-content" className="voting-page" tabIndex={-1}>
      <div className="voting-page__heading">
        <div>
          <div className="voting-page__title"><h1>Vote privately</h1><span className="discovery-page__demo-label">Demo only</span></div>
          <p className="voting-page__intro">Your group sees results only when the round ends.</p>
        </div>
        <ProgressIndicator value={processed} total={votingRestaurants.length} />
      </div>

      {current ? (
        <div className="voting-page__columns">
          <div className="voting-page__visual">
            <img className="voting-photo" src={current.photo} width="620" height="520" alt={`${current.name} demonstration photo`} />
            <p className="voting-keyboard">Keyboard: Y = yes · N = no · V = veto · U = undo</p>
          </div>
          <section className="voting-card" aria-labelledby="voting-restaurant-heading" aria-describedby="voting-demo-note">
            <h2 id="voting-restaurant-heading" tabIndex={-1}>{current.name}</h2>
            <p className="voting-card__meta">{current.cuisine} · {current.price} · {current.rating} · {current.distanceMiles} mi</p>
            <ul className="voting-card__features" aria-label="Sample restaurant features">
              {current.features.map(feature => <li key={feature} className="ui-filter-chip">{feature}</li>)}
            </ul>
            <div className="voting-card__match">
              <h3>Why it matches</h3>
              <p>Inside the 5-mile radius · rating above 4.0 · fits your group’s price range</p>
            </div>
            <TextAction className="voting-card__details" to={generatePath(paths.restaurantDetails, { ...routeParams, restaurantId: current.id })}>View restaurant details →</TextAction>
            <div className="voting-controls" role="group" aria-label={`Vote on ${current.name}`}>
              {(['yes', 'no', 'veto'] as const).map(choice => (
                <Button key={choice} className={`voting-choice voting-choice--${choice}`} aria-label={`Vote ${choice} for ${current.name}`} aria-keyshortcuts={shortcutsEnabled ? choice[0].toUpperCase() : undefined} onClick={event => { if (event.detail < 2) processDecision(choice) }}>{choice.toUpperCase()}</Button>
              ))}
            </div>
            {undoControl}
            <div className="voting-card__footer">
              <p className="voting-card__privacy">Votes stay hidden until everyone finishes.<br /><span>Demo: only your local choices.</span></p>
              <Button className="voting-choice voting-choice--skip" onClick={event => { if (event.detail < 2) processDecision('skip') }} aria-label={`Skip ${current.name} without voting`}>SKIP</Button>
            </div>
          </section>
        </div>
      ) : (
        <section className="voting-complete" aria-labelledby="voting-complete-heading">
          <h2 id="voting-complete-heading" ref={completedRef} className="text-heading-h2" tabIndex={-1}>Demo voting complete</h2>
          <p>You processed all {processed} sample restaurants: {votes.length} {votes.length === 1 ? 'vote' : 'votes'} and {skipped} skipped. These are only your local choices.</p>
          <dl className="voting-complete__counts" aria-label="Your local demo choices">
            {(['yes', 'no', 'veto'] as const).map(choice => <div key={choice}><dt>{choice.toUpperCase()}</dt><dd>{votes.filter(vote => vote.decision === choice).length}</dd></div>)}
          </dl>
          <p>No group results have been calculated. Nothing was sent or saved.</p>
          <div className="voting-complete__actions">{undoControl}<Button onClick={() => dispatch({ type: 'restart' })}>Restart demo</Button><TextAction className="voting-results-link" to={generatePath(paths.results, routeParams)}>View your results →</TextAction></div>
        </section>
      )}

      <p className="voting-status" role="status" aria-atomic="true">{status}</p>
      <aside className="voting-demo-note" aria-label="Voting demonstration details">
        <p id="voting-demo-note"><strong>Frontend demonstration.</strong> Three sample restaurants; no live matches, group votes, or server saves. Lobby <span>{lobbyId}</span> is not loaded. Choices stay in this browser tab per lobby, including after refresh.</p>
        <TextAction to={generatePath(paths.discoveryPreview, routeParams)}>Back to Discovery Preview</TextAction>
        <label className="voting-shortcuts"><input type="checkbox" checked={shortcutsEnabled} onChange={event => setShortcutsEnabled(event.target.checked)} />Enable letter shortcuts</label>
      </aside>
    </main>
  )
}

export function VotingPage() {
  const { lobbyId } = useParams<'lobbyId'>()
  if (!lobbyId?.trim() || lobbyId.startsWith(':')) {
    return (
      <main id="main-content" className="route-placeholder" tabIndex={-1}>
        <h1 className="text-heading-h1">Lobby ID unavailable</h1>
        <p className="text-body-large">Open a lobby link with its ID to try demo voting.</p>
        <TextAction to={paths.joinLobby}>Enter lobby code</TextAction>
      </main>
    )
  }
  return <VotingScreen key={lobbyId} lobbyId={lobbyId} />
}
