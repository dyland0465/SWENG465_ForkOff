/** Synthetic aggregates only. Independent of consumer votes, storage, and APIs. */
export type AnalyticsTotals = {
  impressions: number
  yes: number
  no: number
  veto: number
  wins: number
  dinnerViews: number
  dinnerClicks: number
  mocktailViews: number
  mocktailClicks: number
}

type DailyAnalytics = AnalyticsTotals & { date: string }
export type VoteBucket = { start: string; end: string; label: string; yes: number; no: number; veto: number }
export type ReportingPeriod = { id: string; label: string; start: string; end: string; previousStart: string; previousEnd: string }

// Fixed dates keep this demonstration reproducible and never imply live reporting.
export const reportingPeriods: readonly ReportingPeriod[] = [
  { id: '30-days', label: 'Last 30 days (sample)', start: '2026-08-10', end: '2026-09-08', previousStart: '2026-07-11', previousEnd: '2026-08-09' },
  { id: '7-days', label: 'Last 7 days (sample)', start: '2026-09-02', end: '2026-09-08', previousStart: '2026-08-26', previousEnd: '2026-09-01' },
  { id: 'empty', label: 'June 2026 (no samples)', start: '2026-06-01', end: '2026-06-30', previousStart: '2026-05-02', previousEnd: '2026-05-31' },
]

const emptyTotals = (): AnalyticsTotals => ({ impressions: 0, yes: 0, no: 0, veto: 0, wins: 0, dinnerViews: 0, dinnerClicks: 0, mocktailViews: 0, mocktailClicks: 0 })
const fields = Object.keys(emptyTotals()) as (keyof AnalyticsTotals)[]
const dateAt = (start: string, offset: number) => new Date(Date.parse(`${start}T00:00:00Z`) + offset * 86400000).toISOString().slice(0, 10)

/** Spread fixture totals into whole daily counts; bucket and card totals share these rows. */
function sampleDays(start: string, days: number, totals: AnalyticsTotals): DailyAnalytics[] {
  return Array.from({ length: days }, (_, index) => {
    const row = { date: dateAt(start, index), ...emptyTotals() }
    for (const field of fields) row[field] = Math.floor(totals[field] / days) + (index < totals[field] % days ? 1 : 0)
    return row
  })
}

const demoDays: readonly DailyAnalytics[] = [
  ...sampleDays('2026-07-11', 30, { impressions: 10576, yes: 641, no: 300, veto: 115, wins: 116, dinnerViews: 1800, dinnerClicks: 240, mocktailViews: 1100, mocktailClicks: 160 }),
  ...sampleDays('2026-08-10', 7, { impressions: 2600, yes: 135, no: 69, veto: 36, wins: 24, dinnerViews: 440, dinnerClicks: 62, mocktailViews: 260, mocktailClicks: 38 }),
  ...sampleDays('2026-08-17', 7, { impressions: 2920, yes: 170, no: 78, veto: 30, wins: 28, dinnerViews: 490, dinnerClicks: 72, mocktailViews: 290, mocktailClicks: 45 }),
  ...sampleDays('2026-08-24', 7, { impressions: 3200, yes: 188, no: 89, veto: 24, wins: 34, dinnerViews: 540, dinnerClicks: 84, mocktailViews: 320, mocktailClicks: 54 }),
  ...sampleDays('2026-08-31', 9, { impressions: 3760, yes: 219, no: 90, veto: 27, wins: 40, dinnerViews: 634, dinnerClicks: 100, mocktailViews: 370, mocktailClicks: 64 }),
]

function sum(rows: readonly DailyAnalytics[]): AnalyticsTotals {
  return rows.reduce((totals, row) => {
    for (const field of fields) totals[field] += row[field]
    return totals
  }, emptyTotals())
}

export const formatCount = (value: number) => value.toLocaleString('en-US')
export const formatSampleDate = (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
export const formatSampleRange = (period: ReportingPeriod) => `${formatSampleDate(period.start)}–${formatSampleDate(period.end)}, 2026`
export const voteCount = (totals: AnalyticsTotals) => totals.yes + totals.no + totals.veto
export const percentage = (part: number, whole: number) => whole > 0 ? part / whole * 100 : null
export const formatRate = (rate: number | null) => rate === null ? '—' : `${rate.toFixed(1)}%`

/** Replace the fixture source with authenticated, scoped aggregate API data later. */
export function getDemoPartnerReport(period: ReportingPeriod, hasFixture = true) {
  const rows = hasFixture ? demoDays.filter(row => row.date >= period.start && row.date <= period.end) : []
  const previousRows = hasFixture ? demoDays.filter(row => row.date >= period.previousStart && row.date <= period.previousEnd) : []
  const buckets: VoteBucket[] = []
  const daily = period.id === '7-days'
  for (let index = 0; index < rows.length; index += daily ? 1 : 7) {
    // The final bucket includes the remaining nine days of the 30-day sample.
    const bucketRows = rows.slice(index, daily ? index + 1 : index >= 21 ? rows.length : index + 7)
    const totals = sum(bucketRows)
    buckets.push({ start: bucketRows[0].date, end: bucketRows.at(-1)!.date, label: formatSampleDate(bucketRows[0].date), yes: totals.yes, no: totals.no, veto: totals.veto })
    if (!daily && index >= 21) break
  }
  return { period, hasData: rows.length > 0, totals: sum(rows), previous: previousRows.length ? sum(previousRows) : null, buckets }
}

export type PartnerReport = ReturnType<typeof getDemoPartnerReport>

/** All CSV rows describe only the selected, visible sample report. No prior-period data. */
export function partnerReportCsv(report: PartnerReport): string {
  const { period, totals, buckets } = report
  const prefix = ['Demonstration data — not live analytics', 'Harbor & Hearth (sample)', period.start, period.end]
  const rows: (string | number)[][] = [
    ['data_source', 'restaurant', 'report_start', 'report_end', 'section', 'label', 'bucket_start', 'bucket_end', 'impressions', 'yes', 'no', 'veto', 'total_votes', 'lobby_wins', 'veto_rate_percent', 'views', 'clicks', 'ctr_percent'],
    [...prefix, 'summary', 'Selected sample period', '', '', totals.impressions, totals.yes, totals.no, totals.veto, voteCount(totals), totals.wins, percentage(totals.veto, voteCount(totals))?.toFixed(1) ?? '', '', '', ''],
    ...buckets.map(bucket => [...prefix, 'vote_mix', bucket.label, bucket.start, bucket.end, '', bucket.yes, bucket.no, bucket.veto, bucket.yes + bucket.no + bucket.veto, '', '', '', '', '']),
    [...prefix, 'promotion', 'Featured dinner offer', '', '', '', '', '', '', '', '', '', totals.dinnerViews, totals.dinnerClicks, percentage(totals.dinnerClicks, totals.dinnerViews)?.toFixed(1) ?? ''],
    [...prefix, 'promotion', 'Weekend mocktail spotlight', '', '', '', '', '', '', '', '', '', totals.mocktailViews, totals.mocktailClicks, percentage(totals.mocktailClicks, totals.mocktailViews)?.toFixed(1) ?? ''],
  ]
  return rows.map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n'
}
