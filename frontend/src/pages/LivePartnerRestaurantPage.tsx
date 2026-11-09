import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { TextInput } from '../components/ui/FormField'
import { useAuth } from '../features/auth/useAuth'
import { getDemoPartnerReport, reportingPeriods } from '../features/partner/demoPartnerAnalytics'
import { paths } from '../routes/paths'
import './PartnerRestaurantPage.css'
import './LivePartnerRestaurantPage.css'

type Totals = { appearances: number; completed: number; abandoned: number; yes: number; no: number; veto: number; skip: number; topThree: number; first: number; ties: number; vetoed: number; cardViews: number; mapsClicks: number; favoriteAdds: number; favoriteRemoves: number; collectionAdds: number; collectionRemoves: number }
type Report = { restaurantName: string; start: string; end: string; collectionStartedAt: string | null; totals: Totals; previous: Totals; current: { favorites: number; collections: number }; buckets: (Totals & { date: string })[] }
const labels: [keyof Totals, string][] = [
  ['appearances', 'Round appearances'], ['completed', 'Completed rounds'], ['abandoned', 'Abandoned rounds'], ['cardViews', 'Voting card views'],
  ['yes', 'Yes votes'], ['no', 'No votes'], ['veto', 'Veto votes'], ['skip', 'Skipped'],
  ['first', 'First place'], ['topThree', 'Top three'], ['ties', 'Tied results'], ['vetoed', 'Vetoed rounds'],
  ['mapsClicks', 'Google Maps clicks'], ['favoriteAdds', 'Favorite additions'], ['favoriteRemoves', 'Favorite removals'],
  ['collectionAdds', 'Collection additions'], ['collectionRemoves', 'Collection removals'],
]
const day = (offset: number) => new Date(Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)
const rateValue = (value: number, total: number) => total ? value * 100 / total : null
const rate = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`
const number = (value: number) => value.toLocaleString('en-US')
const csvCell = (value: string | number) => `"${String(value).replaceAll('"', '""')}"`
const shortDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
const emptyTotals = (): Totals => ({ appearances: 0, completed: 0, abandoned: 0, yes: 0, no: 0, veto: 0, skip: 0, topThree: 0, first: 0, ties: 0, vetoed: 0, cardViews: 0, mapsClicks: 0, favoriteAdds: 0, favoriteRemoves: 0, collectionAdds: 0, collectionRemoves: 0 })
function mockReport(): Report {
  const sample = getDemoPartnerReport(reportingPeriods[0])
  const convert = (totals: typeof sample.totals): Totals => ({ ...emptyTotals(), appearances: totals.impressions, yes: totals.yes, no: totals.no, veto: totals.veto, first: totals.wins })
  return { restaurantName: 'Harbor & Hearth', start: sample.period.start, end: sample.period.end, collectionStartedAt: null,
    totals: convert(sample.totals), previous: sample.previous ? convert(sample.previous) : emptyTotals(), current: { favorites: 0, collections: 0 },
    buckets: sample.buckets.map(bucket => ({ ...emptyTotals(), date: bucket.start, yes: bucket.yes, no: bucket.no, veto: bucket.veto })) }
}

function comparison(current: number | null, previous: number | null, points = false) {
  if (current === null || previous === null || (!points && previous === 0)) return 'No prior comparison'
  const delta = points ? current - previous : (current - previous) / previous * 100
  if (Math.abs(delta) < 0.05) return 'Unchanged vs prior period'
  return `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(points ? 1 : 0)}${points ? ' pts' : '%'} vs prior period`
}

function Metric({ label, value, comparisonText }: { label: string; value: string; comparisonText: string }) {
  return <div className="partner-metric"><dt>{label}</dt><dd className="partner-metric__value">{value}</dd><dd className="partner-metric__trend">{comparisonText}</dd></div>
}

function VoteMix({ report, mock }: { report: Report; mock: boolean }) {
  const start = Date.parse(`${report.start}T00:00:00Z`)
  const days = Math.round((Date.parse(`${report.end}T00:00:00Z`) - start) / 86400000) + 1
  const step = Math.max(1, Math.ceil(days / 7))
  const computed = Array.from({ length: Math.ceil(days / step) }, (_, index) => {
    const from = new Date(start + index * step * 86400000).toISOString().slice(0, 10)
    const through = new Date(start + Math.min(days - 1, (index + 1) * step - 1) * 86400000).toISOString().slice(0, 10)
    const rows = report.buckets.filter(row => row.date >= from && row.date <= through)
    return { from, through, yes: rows.reduce((n, row) => n + row.yes, 0), no: rows.reduce((n, row) => n + row.no, 0), veto: rows.reduce((n, row) => n + row.veto, 0) }
  })
  const buckets = mock ? getDemoPartnerReport(reportingPeriods[0]).buckets.map(bucket => ({ from: bucket.start, through: bucket.end, yes: bucket.yes, no: bucket.no, veto: bucket.veto })) : computed
  const peak = Math.max(1, ...buckets.flatMap(bucket => [bucket.yes, bucket.no, bucket.veto]))
  const hasVotes = report.totals.yes + report.totals.no + report.totals.veto > 0
  return <div className="partner-vote-section"><figure className="partner-panel partner-votes" aria-labelledby="live-votes-title">
    <figcaption className="partner-votes__heading"><div><h2 id="live-votes-title">Vote mix over time</h2><p>{mock ? 'Sample totals by week' : `Completed rounds · ${step === 1 ? 'Daily' : `${step}-day`} totals`}</p></div>
      <ul className="partner-legend" aria-label="Vote types">{['Yes', 'No', 'Veto'].map(label => <li key={label}><span className={`partner-swatch partner-swatch--${label.toLowerCase()}`} aria-hidden="true" />{label}</li>)}</ul>
    </figcaption>
    {hasVotes ? <div className={`partner-chart live-partner-chart${buckets.length > 4 ? ' partner-chart--daily' : ''}`} aria-hidden="true">
      {buckets.map(bucket => <div className="partner-chart__group" key={bucket.from}><div className="partner-chart__bars">{(['yes', 'no', 'veto'] as const).map(choice => <div key={choice} className={`partner-chart__bar partner-swatch--${choice}`} style={{ height: `${bucket[choice] / peak * 100}%` }} />)}</div><span className="partner-chart__date">{shortDate(bucket.from)}</span><span className="partner-chart__values">Y {bucket.yes} · N {bucket.no} · V {bucket.veto}</span></div>)}
    </div> : <div className="live-partner-chart-empty"><p>No completed votes for this period.</p><span>Vote totals will appear here as groups finish rounds.</span></div>}
  </figure>
  {hasVotes && <details className="partner-data-table"><summary>View vote data table</summary><div className="live-partner-table"><table><caption>Votes by reporting interval · UTC</caption><thead><tr><th>Dates</th><th>Yes</th><th>No</th><th>Veto</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.from}><th scope="row">{bucket.from}–{bucket.through}</th><td>{bucket.yes}</td><td>{bucket.no}</td><td>{bucket.veto}</td></tr>)}</tbody></table></div></details>}
  </div>
}

export function LivePartnerRestaurantPage() {
  const { restaurantId = '' } = useParams()
  const { signOut } = useAuth()
  const [start, setStart] = useState(day(-29))
  const [end, setEnd] = useState(day(0))
  const [liveReport, setReport] = useState<Report | null>(null)
  const [mock, setMock] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const controller = new AbortController()
    setLoading(true); setError(''); setReport(null)
    const query = new URLSearchParams({ start, end })
    fetch(`/api/restaurants/${encodeURIComponent(restaurantId)}/analytics?${query}`, { signal: controller.signal, cache: 'no-store' })
      .then(async response => {
        if (response.status === 401) throw new Error('Sign in to view this dashboard.')
        if (response.status === 403) throw new Error('This account does not have access to this restaurant.')
        if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.message ?? 'Could not load analytics.') }
        return response.json() as Promise<Report>
      }).then(setReport).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Could not load analytics.') })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    return () => controller.abort()
  }, [restaurantId, start, end])
  const report = mock ? mockReport() : liveReport

  function exportCsv() {
    if (!report) return
    const exported = mock ? labels.filter(([key]) => ['appearances', 'yes', 'no', 'veto', 'first'].includes(key)) : labels
    const rows = mock
      ? [['data_source', 'section', 'start', 'end', ...exported.map(([key]) => key)],
        ['mock', 'summary', report.start, report.end, ...exported.map(([key]) => report.totals[key])],
        ...getDemoPartnerReport(reportingPeriods[0]).buckets.map(bucket => ['mock', 'vote_mix', bucket.start, bucket.end, '', bucket.yes, bucket.no, bucket.veto, ''])]
      : [['data_source', 'date', ...exported.map(([key]) => key)], ...report.buckets.map(bucket => ['live', bucket.date, ...exported.map(([key]) => bucket[key])])]
    const blob = new Blob(['\uFEFF', rows.map(row => row.map(csvCell).join(',')).join('\r\n'), '\r\n'], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob); const link = document.createElement('a')
    link.href = url; link.download = `forkoff-${mock ? 'mock' : 'analytics'}-${report.start}-${report.end}.csv`; link.click()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const earliest = report?.collectionStartedAt?.slice(0, 10)
  const unavailable = Boolean(earliest && (report?.end ?? end) < earliest)
  const startTime = Date.parse(`${report?.start ?? start}T00:00:00Z`)
  const previousEnd = Number.isFinite(startTime) ? new Date(startTime - 86400000).toISOString().slice(0, 10) : ''
  const previousUnavailable = Boolean(earliest && previousEnd < earliest)
  const totals = report?.totals
  const previous = report?.previous
  const votes = totals ? totals.yes + totals.no + totals.veto : 0
  const previousVotes = previous ? previous.yes + previous.no + previous.veto : 0
  const vetoRate = totals ? rateValue(totals.veto, votes) : null
  const priorVetoRate = previous ? rateValue(previous.veto, previousVotes) : null
  const value = (n: number) => unavailable ? '—' : number(n)
  const trend = (now: number | null, before: number | null, points = false) => comparison(unavailable ? null : now, previousUnavailable ? null : before, points)
  const extra: [keyof Totals, string][] = [['completed', 'Completed rounds'], ['abandoned', 'Abandoned rounds'], ['cardViews', 'Voting card views'], ['no', 'No votes'], ['skip', 'Skipped'], ['topThree', 'Top three'], ['ties', 'Tied results'], ['vetoed', 'Vetoed rounds'], ['mapsClicks', 'Google Maps clicks'], ['favoriteAdds', 'Favorite additions'], ['favoriteRemoves', 'Favorite removals'], ['collectionAdds', 'Collection additions'], ['collectionRemoves', 'Collection removals']]

  return <>
    <header className="partner-header"><a className="skip-link" href="#main-content">Skip to main content</a><div className="partner-header__inner">
      <Link className="partner-header__brand" to={paths.home}>Fork Off! for Partners</Link>
      <nav className="live-partner-nav" aria-label="Partner navigation"><a href="#main-content">Overview</a><a href="#live-details-title">More insights</a><Link to={paths.partnerAccess}>Your restaurants</Link><button type="button" onClick={() => void signOut().then(() => { window.location.assign(paths.partnerAccess) }).catch(() => setError('Could not sign out.'))}>Sign out</button></nav>
    </div></header>
    <main id="main-content" className="partner-page live-partner-page" tabIndex={-1}>
      <div className="partner-page__intro"><div className="partner-page__title"><h1>Partner analytics</h1><p>{report?.restaurantName ?? 'Restaurant insights'} · lobby performance</p></div>
        <div className="live-partner-controls"><TextInput label="From (UTC)" id="analytics-start" type="date" value={mock ? report!.start : start} disabled={mock} onChange={event => setStart(event.target.value)} /><TextInput label="Through (UTC)" id="analytics-end" type="date" value={mock ? report!.end : end} disabled={mock} onChange={event => setEnd(event.target.value)} /><Button onClick={exportCsv} disabled={!report} className="partner-export">Export CSV</Button></div>
      </div>
      <div className="live-partner-mode"><span>{mock ? 'Mock data' : 'Live data'}</span><button type="button" className="live-partner-toggle" role="switch" aria-checked={mock} onClick={() => setMock(current => !current)}><span className="live-partner-toggle__track" aria-hidden="true"><span /></span>Use mock data</button></div>
      {!mock && loading && <p className="live-partner-status" role="status">Loading analytics…</p>}{!mock && error && <p className="live-partner-status live-partner-status--error" role="alert">{error} <Link to={paths.partnerAccess}>Partner access</Link></p>}
      {report && totals && previous && <>
        <p className="partner-demo-notice">{mock ? <><strong>Mock data</strong> · Harbor &amp; Hearth sample · {shortDate(report.start)}–{shortDate(report.end)}, 2026. These figures are synthetic and are not saved to MongoDB.</> : <><strong>Live analytics</strong> · {shortDate(report.start)}–{shortDate(report.end)} · UTC. Data collection began {earliest ?? 'recently'}; periods before then are incomplete.</>}</p>
        <dl className="partner-metrics" aria-label="Analytics overview">
          <Metric label="Round appearances" value={value(totals.appearances)} comparisonText={trend(totals.appearances, previous.appearances)} />
          <Metric label="Yes votes" value={value(totals.yes)} comparisonText={trend(totals.yes, previous.yes)} />
          <Metric label="First place" value={value(totals.first)} comparisonText={trend(totals.first, previous.first)} />
          <Metric label="Veto rate" value={rate(vetoRate)} comparisonText={trend(vetoRate, priorVetoRate, true)} />
        </dl>
        <div className="partner-details"><VoteMix report={report} mock={mock} /><div className="partner-details__aside">
          <section className="partner-panel live-partner-saved" aria-labelledby="live-saved-title"><h2 id="live-saved-title">Saved by diners</h2><p>{mock ? 'Save counts are not included in the sample.' : 'Current saves across Fork Off!'}</p><dl><div><dt>Favorites</dt><dd>{mock ? '—' : number(report.current.favorites)}</dd></div><div><dt>Collections</dt><dd>{mock ? '—' : number(report.current.collections)}</dd></div></dl></section>
          <aside className="partner-privacy"><h2>Your insights, in context</h2><p>Results show aggregate activity. Individual voter names and choices are not shared with partners.</p></aside>
        </div></div>
        <section className="partner-panel live-partner-details" aria-labelledby="live-details-title"><div className="live-partner-details__heading"><div><h2 id="live-details-title">More insights</h2><p>Additional activity for the selected period</p></div><p>Previous period shown for comparison</p></div>
          <dl className="live-partner-detail-grid">{extra.map(([key, label]) => <div key={key}><dt>{label}</dt><dd>{mock ? '—' : value(totals[key])}</dd><dd className="live-partner-detail-previous">{mock ? 'Not in sample' : `Previous: ${previousUnavailable ? 'Unavailable' : number(previous[key])}`}</dd></div>)}</dl>
        </section>
        <p className="partner-page__footnote">Appearances count rounds containing this restaurant, while card views count displays. Vote totals and rankings use completed rounds; skips are excluded from rates. First place uses the displayed tie break and does not mean the group visited. Browser-based events may be incomplete. Recent round data may take a few seconds to appear.</p>
      </>}
    </main>
  </>
}
