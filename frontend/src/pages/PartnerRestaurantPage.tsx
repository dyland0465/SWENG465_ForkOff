import { useEffect, useRef, useState } from 'react'
import { Link, generatePath, useNavigate, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { SelectField } from '../components/ui/FormField'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'
import { formatCount, formatRate, formatSampleRange, getDemoPartnerReport, partnerReportCsv, percentage, reportingPeriods, voteCount } from '../features/partner/demoPartnerAnalytics'
import type { PartnerReport } from '../features/partner/demoPartnerAnalytics'
import { usePartnerDemoPreview } from '../features/partner/partnerDemoPreviewState'
import './PartnerRestaurantPage.css'

function trend(current: number | null, previous: number | null, points = false) {
  if (current === null || previous === null || (!points && previous === 0)) return { text: 'No prior sample comparison', positive: false }
  const delta = points ? current - previous : (current - previous) / previous * 100
  if (Math.abs(delta) < 0.05) return { text: 'Unchanged vs prior sample', positive: false }
  return { text: `${delta > 0 ? '↑' : '↓'} ${Math.abs(delta).toFixed(points ? 1 : 0)}${points ? ' pts' : '%'} vs prior sample`, positive: points ? delta < 0 : delta > 0 }
}

function MetricCard({ label, value, comparison }: { label: string; value: string; comparison: ReturnType<typeof trend> }) {
  return (
    <div className="partner-metric">
      <dt>{label}</dt>
      <dd className="partner-metric__value">{value}</dd>
      <dd className={`partner-metric__trend${comparison.positive ? ' partner-metric__trend--positive' : ''}`}>{comparison.text}</dd>
    </div>
  )
}

function VoteMix({ report }: { report: PartnerReport }) {
  const peak = Math.max(1, ...report.buckets.flatMap(bucket => [bucket.yes, bucket.no, bucket.veto]))
  const step = peak > 100 ? 40 : 10
  const max = Math.ceil(peak / step) * step
  return (
    <div className="partner-vote-section">
      <figure className="partner-panel partner-votes" aria-labelledby="partner-votes-title" aria-describedby="partner-vote-summary">
      <figcaption className="partner-votes__heading">
        <div><h2 id="partner-votes-title">Vote mix over time</h2><p>{report.period.id === '7-days' ? 'Daily' : 'Weekly'} sample totals{report.hasData && ` · scale 0–${max}`}</p></div>
        <ul className="partner-legend" aria-label="Vote types">
          {['Yes', 'No', 'Veto'].map(label => <li key={label}><span className={`partner-swatch partner-swatch--${label.toLowerCase()}`} aria-hidden="true" />{label}</li>)}
        </ul>
      </figcaption>
      {report.hasData ? <>
        <div className={`partner-chart${report.buckets.length > 4 ? ' partner-chart--daily' : ''}`} aria-hidden="true">
          {report.buckets.map(bucket => <div className="partner-chart__group" key={bucket.start}>
            <div className="partner-chart__bars">
              {(['yes', 'no', 'veto'] as const).map(choice => <div key={choice} className={`partner-chart__bar partner-swatch--${choice}`} style={{ height: `${bucket[choice] / max * 100}%` }} />)}
            </div>
            <span className="partner-chart__date">{bucket.label}</span>
            <span className="partner-chart__values">Y {bucket.yes} · N {bucket.no} · V {bucket.veto}</span>
          </div>)}
        </div>
        <p id="partner-vote-summary" className="partner-sr-only">{formatCount(voteCount(report.totals))} sample votes: {formatCount(report.totals.yes)} Yes, {formatCount(report.totals.no)} No, {formatCount(report.totals.veto)} Veto. All bars in this report use a scale of 0 to {max}. Exact date ranges and values follow.</p>
      </> : <p id="partner-vote-summary" className="partner-empty">No sample votes for this restaurant and reporting period. Choose another period or open the Harbor &amp; Hearth demo.</p>}
      </figure>
      {report.hasData && <details className="partner-data-table">
          <summary>View vote data table</summary>
          <table>
            <caption>Demonstration votes · {formatSampleRange(report.period)}.{report.period.id === '30-days' && ' The final weekly bucket includes the remaining days.'}</caption>
            <thead><tr><th scope="col">Dates (2026)</th><th scope="col">Yes</th><th scope="col">No</th><th scope="col">Veto</th><th scope="col">Total</th></tr></thead>
            <tbody>{report.buckets.map(bucket => <tr key={bucket.start}><th scope="row">{bucket.start.slice(5)}–{bucket.end.slice(5)}</th><td>{bucket.yes}</td><td>{bucket.no}</td><td>{bucket.veto}</td><td>{bucket.yes + bucket.no + bucket.veto}</td></tr>)}</tbody>
            <tfoot><tr><th scope="row">Total</th><td>{report.totals.yes}</td><td>{report.totals.no}</td><td>{report.totals.veto}</td><td>{voteCount(report.totals)}</td></tr></tfoot>
          </table>
        </details>}
    </div>
  )
}

function PartnerDashboard({ restaurantId }: { restaurantId: string | undefined }) {
  const preview = usePartnerDemoPreview()
  const navigate = useNavigate()
  const [periodId, setPeriodId] = useState(reportingPeriods[0].id)
  const [showSupport, setShowSupport] = useState(false)
  const [exportMessage, setExportMessage] = useState('')
  const supportHeading = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    if (showSupport) supportHeading.current?.focus()
  }, [showSupport])
  const hasFixture = restaurantId === 'harbor'
  const period = reportingPeriods.find(item => item.id === periodId) ?? reportingPeriods[0]
  const report = getDemoPartnerReport(period, hasFixture)
  const { totals, previous, hasData } = report
  const currentVetoRate = hasData ? percentage(totals.veto, voteCount(totals)) : null
  const previousVetoRate = previous ? percentage(previous.veto, voteCount(previous)) : null

  function exportCsv() {
    try {
      const url = URL.createObjectURL(new Blob(['\uFEFF', partnerReportCsv(report)], { type: 'text/csv;charset=utf-8' }))
      const link = document.createElement('a')
      link.href = url
      link.download = `fork-off-demo-harbor-${period.start}-to-${period.end}.csv`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 1000)
      setExportMessage(`Demo CSV download requested for ${formatSampleRange(period)}.`)
    } catch {
      setExportMessage('CSV download could not start. Please try again in your browser.')
    }
  }

  return <>
    <header className="partner-header">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="partner-header__inner">
        <Link className="partner-header__brand" to={paths.home} aria-label="Fork Off home">Fork Off! for Partners</Link>
        <nav aria-label="Partner navigation">
          <TextAction tone="nav" current href="#main-content" onClick={() => document.getElementById('main-content')?.focus()}>Overview</TextAction>
          <TextAction tone="nav" href="#partner-promotions-title" onClick={() => document.getElementById('partner-promotions-title')?.focus()}>Promotions</TextAction>
          <TextAction tone="nav" aria-expanded={showSupport} aria-controls="partner-support" onClick={() => setShowSupport(value => !value)}>Support</TextAction>
          <TextAction tone="nav" onClick={() => { preview.exit(); navigate(paths.partnerAccess, { replace: true }) }}>Exit demo preview</TextAction>
        </nav>
      </div>
    </header>
    <main id="main-content" className="partner-page" tabIndex={-1}>
      <div className="partner-page__intro">
        <div className="partner-page__title"><h1>Partner analytics</h1><p>{hasFixture ? 'Harbor & Hearth · sample lobby performance' : 'Partner preview · no sample restaurant selected'}</p></div>
        <div className="partner-controls">
          <SelectField label="Reporting period" id="partner-reporting-period" value={periodId} onChange={event => { setPeriodId(event.target.value); setExportMessage('') }}>
            {reportingPeriods.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}
          </SelectField>
          <Button onClick={exportCsv} disabled={!hasData} className="partner-export">Export CSV</Button>
        </div>
      </div>
      <p className="partner-demo-notice"><strong>Demonstration data</strong> · {formatSampleRange(period)} · Development preview, no authenticated partner access. All figures are synthetic. {!hasFixture && <Link to={generatePath(paths.partnerRestaurant, { restaurantId: 'harbor' })}>Open Harbor &amp; Hearth demo</Link>}</p>
      <p role="status" className="partner-sr-only">{exportMessage || `${hasData ? 'Sample report updated' : 'No sample data'}: ${formatSampleRange(period)}. ${formatCount(voteCount(totals))} votes; ${formatCount(totals.impressions)} impressions. Charts, metrics, and promotions use this period.`}</p>
      {showSupport && <section id="partner-support" className="partner-panel partner-support" aria-labelledby="partner-support-title">
        <h2 id="partner-support-title" tabIndex={-1} ref={supportHeading}>Partner preview support</h2>
        <p>Explore sample reporting periods, view exact vote counts, or export the displayed demo figures. Click-through rate (CTR) is clicks ÷ views; veto rate is Veto ÷ all Yes, No, and Veto votes. Impressions count sample restaurant appearances; lobby wins count sample selections. Trends compare the preceding period of equal length.</p>
        <p>This development preview has no partner account, live reporting, promotion editing, or customer records.</p>
        <Button variant="secondary" onClick={() => { setShowSupport(false); document.querySelector<HTMLButtonElement>('[aria-controls="partner-support"]')?.focus() }}>Close support</Button>
      </section>}
      <dl className="partner-metrics" aria-label="Sample analytics metrics">
        <MetricCard label="Impressions" value={hasData ? formatCount(totals.impressions) : '—'} comparison={trend(hasData ? totals.impressions : null, previous?.impressions ?? null)} />
        <MetricCard label="Yes votes" value={hasData ? formatCount(totals.yes) : '—'} comparison={trend(hasData ? totals.yes : null, previous?.yes ?? null)} />
        <MetricCard label="Lobby wins" value={hasData ? formatCount(totals.wins) : '—'} comparison={trend(hasData ? totals.wins : null, previous?.wins ?? null)} />
        <MetricCard label="Veto rate" value={formatRate(currentVetoRate)} comparison={trend(currentVetoRate, previousVetoRate, true)} />
      </dl>
      <div className="partner-details">
        <VoteMix report={report} />
        <div className="partner-details__aside">
          <section className="partner-panel partner-promotions" aria-labelledby="partner-promotions-title">
            <h2 id="partner-promotions-title" tabIndex={-1}>Promotion engagement</h2>
            {hasData ? <ul>{[
              { name: 'Featured dinner offer', views: totals.dinnerViews, clicks: totals.dinnerClicks },
              { name: 'Weekend mocktail spotlight', views: totals.mocktailViews, clicks: totals.mocktailClicks },
            ].map(promotion => <li key={promotion.name}><h3>{promotion.name}</h3><p><span>{formatCount(promotion.views)} views</span><span>{formatCount(promotion.clicks)} clicks</span><span>{formatRate(percentage(promotion.clicks, promotion.views))} CTR</span></p></li>)}</ul> : <p className="partner-empty">No sample promotion engagement for this period.</p>}
          </section>
          <aside className="partner-privacy" aria-labelledby="partner-privacy-title"><h2 id="partner-privacy-title">Privacy by design</h2><p>This preview uses synthetic aggregates only. No individual voter names, messages, or vote histories are available to partners.</p></aside>
        </div>
      </div>
      <p className="partner-page__footnote">Sample reporting ends Sep 8, 2026. No live analytics or restaurant management is connected. CSV exports contain only the selected demo period.</p>
    </main>
  </>
}

export function PartnerRestaurantPage() {
  const { restaurantId } = useParams()
  return <PartnerDashboard key={restaurantId} restaurantId={restaurantId} />
}
