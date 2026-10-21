import { useRef, useState } from 'react'
import { generatePath, useNavigate, useParams, useSearchParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { votingRestaurants } from '../data/demoRestaurants'
import { useVotingSession } from '../features/voting/useVotingSession'
import { calculateVotingResults } from '../features/voting/votingResults'
import { paths } from '../routes/paths'
import './ResultsPage.css'

const decisionLabels = { yes: 'Your vote: Yes', no: 'Your vote: No', veto: 'Your vote: Veto', skip: 'Skipped · no vote' }

function ResultsScreen({ lobbyId }: { lobbyId: string }) {
  const { session, dispatch } = useVotingSession(lobbyId)
  const results = calculateVotingResults(votingRestaurants, session)
  const [search, setSearch] = useSearchParams()
  const [status, setStatus] = useState('')
  const listHeading = useRef<HTMLHeadingElement>(null)
  const navigate = useNavigate()
  const selected = results.eligible.find(row => row.restaurant.id === search.get('selection'))?.restaurant
  const preview = selected ?? results.eligible[0]?.restaurant
  const returnToResults = { fromResults: true, selection: selected?.id }
  const votingPath = generatePath(paths.voting, { lobbyId })

  function restart() {
    dispatch({ type: 'restart' })
    navigate(votingPath)
  }

  async function share() {
    if (!selected) return
    const text = `Fork Off! demo selection: ${selected.name}. This is my local choice, not a group match. Sample restaurant information is not verified.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Fork Off! demonstration choice', text })
        setStatus('Demo selection shared.')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text)
        setStatus('Demo selection copied. Local votes are not included.')
      } else setStatus(`Copy this demonstration choice: ${selected.name}. Not a group match.`)
    } catch {
      setStatus(`Sharing did not complete. Your demo selection is still ${selected.name}.`)
    }
  }

  return (
    <main id="main-content" className="results-page" tabIndex={-1}>
      <header className="results-page__heading">
        <div>
          <div className="results-page__title"><h1>Your voting results</h1><span className="discovery-page__demo-label">Local demo</span></div>
          <p className="results-page__intro">Your choices, ranked for a demonstration final selection.</p>
        </div>
        <div className="results-summary" aria-label="Local voting summary">
          <p>{results.total} sample restaurants · only your choices</p>
          <p>{results.processed} of {results.total} processed · {results.complete ? 'Demo round complete' : results.processed ? 'Voting incomplete' : 'No local choices yet'}</p>
        </div>
      </header>

      <div className="results-page__columns">
        <section className="results-ranking" aria-labelledby="results-ranking-heading">
          <h2 ref={listHeading} id="results-ranking-heading" tabIndex={-1}>Your restaurant ranking</h2>
          <ol className="results-list">
            {results.rows.map(({ restaurant, decision, rank }) => (
              <li key={restaurant.id} className={`results-row${decision === 'yes' ? ' results-row--yes' : ''}${selected?.id === restaurant.id ? ' results-row--selected' : ''}`}>
                <span className="results-row__rank" aria-label={rank ? 'Rank 1, tied for your Yes choices' : 'Unranked'}>{rank ?? '–'}</span>
                <img className="results-row__photo" src={restaurant.photo} width="48" height="48" alt="" />
                <div className="results-row__copy">
                  <h3><TextAction to={generatePath(paths.restaurantDetails, { lobbyId, restaurantId: restaurant.id })} state={returnToResults}>{restaurant.name}</TextAction></h3>
                  <p>{restaurant.cuisine} · {restaurant.price} · {restaurant.rating} · {restaurant.distanceMiles} mi</p>
                  <p className={`results-row__decision results-row__decision--${decision ?? 'pending'}`}>{decision ? decisionLabels[decision] : 'Not yet reviewed'}</p>
                </div>
                {decision === 'yes' && <Button className="results-row__choose" aria-pressed={selected?.id === restaurant.id} aria-label={`Choose ${restaurant.name} as your demo selection`} onClick={() => { setSearch({ selection: restaurant.id }, { preventScrollReset: true }); setStatus('') }}>{selected?.id === restaurant.id ? 'Chosen' : 'Choose'}</Button>}
              </li>
            ))}
          </ol>
          <dl className="results-counts" aria-label="Your local decisions">
            {(['yes', 'no', 'veto', 'skip'] as const).map(choice => <div key={choice}><dt>{choice === 'skip' ? 'Skipped' : choice.toUpperCase()}</dt><dd>{results.counts[choice]}</dd></div>)}
          </dl>
          <p className="results-ranking__note">Only Yes choices are ranked and eligible to choose. All Yes choices tie at #1; display order follows the voting list. No and Veto exclude a choice; skips and unreviewed places receive no vote.</p>
          {!results.complete && <div className="results-incomplete"><p>{results.processed ? `${results.remaining} restaurants still to review. This is a partial view of your choices.` : 'No votes in this lobby yet. Start voting, or resume after navigating back. Choices survive refresh in this browser tab.'}</p><TextAction className="results-resume" to={votingPath}>{results.processed ? 'Continue voting →' : 'Start voting →'}</TextAction></div>}
        </section>

        <aside className="results-choice" aria-labelledby="results-choice-heading">
          {preview ? <>
            <img className="results-choice__photo" src={preview.photo} width="460" height="220" alt={`${preview.name} demonstration photo`} />
            <div className="results-choice__body">
              <p className="results-choice__eyebrow">{selected ? 'DEMO FINAL CHOICE' : 'PREVIEW A YES CHOICE'}</p>
              <h2 id="results-choice-heading">{preview.name}</h2>
              <p className="results-choice__meta">{preview.cuisine} · {preview.price} · {preview.distanceMiles} mi</p>
              <TextAction className="results-choice__details" to={generatePath(paths.restaurantDetails, { lobbyId, restaurantId: preview.id })} state={returnToResults}>View restaurant details →</TextAction>
              <div className="results-choice__actions">
                <Button onClick={() => setStatus('Directions are not connected. Sample restaurant addresses are not verified; no navigation service is available.')}>Directions</Button>
                <Button variant="secondary" disabled={!selected} onClick={share}>Share</Button>
                <Button variant="secondary" onClick={() => { listHeading.current?.focus(); listHeading.current?.scrollIntoView({ block: 'nearest' }) }}>Full results</Button>
              </div>
              <p className="results-choice__note">{selected ? 'Your demonstration choice only. This is not a real group match.' : 'Choose a Yes restaurant from the list to make a demo final selection. No restaurant is selected automatically.'}</p>
              <TextAction className="results-restart" onClick={restart}>Restart Voting →</TextAction>
            </div>
          </> : <div className="results-choice__empty">
            <p className="results-choice__eyebrow">DEMO FINAL CHOICE</p>
            <h2 id="results-choice-heading">{results.processed === 0 ? 'Your choice starts here' : results.counts.no + results.counts.veto === results.total ? 'No restaurants accepted' : 'No Yes choices yet'}</h2>
            <p>{results.counts.skip === results.total ? 'All restaurants were skipped. No votes were recorded.' : 'A Yes vote makes a restaurant eligible for your demonstration selection. No group winner has been calculated.'}</p>
            {!results.complete && <TextAction to={votingPath}>{results.processed ? 'Continue voting →' : 'Start voting →'}</TextAction>}
            <TextAction className="results-restart" onClick={restart}>Restart Voting →</TextAction>
          </div>}
        </aside>
      </div>
      <p className="results-status" role="status" aria-atomic="true">{status || (selected ? `${selected.name} selected for this demonstration only. No group winner has been declared.` : '')}</p>
      <footer className="results-footer">
        <p><strong>Individual demonstration results.</strong> {results.votes} local {results.votes === 1 ? 'vote' : 'votes'} · {results.counts.skip} skipped. No other members’ votes, group approval percentages, or consensus are available. Photos and restaurant details are sample data. Choices remain in this browser tab for lobby <span>{lobbyId}</span> during navigation and refresh.</p>
        <div><TextAction className="results-lobby" to={generatePath(paths.lobby, { lobbyId })}>Return to Lobby</TextAction><TextAction to={generatePath(paths.discoveryPreview, { lobbyId })}>Review filters</TextAction></div>
      </footer>
    </main>
  )
}

export function ResultsPage() {
  const { lobbyId } = useParams<'lobbyId'>()
  if (!lobbyId?.trim() || lobbyId.startsWith(':')) return <main id="main-content" className="route-placeholder" tabIndex={-1}><h1 className="text-heading-h1">Lobby ID unavailable</h1><p>Open a lobby link with its ID to view local results.</p><TextAction to={paths.joinLobby}>Enter lobby code</TextAction></main>
  return <ResultsScreen key={lobbyId} lobbyId={lobbyId} />
}
