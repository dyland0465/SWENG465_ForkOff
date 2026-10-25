import test from 'node:test'
import assert from 'node:assert/strict'
import { getDemoPartnerReport, partnerReportCsv, percentage, reportingPeriods, voteCount } from '../src/features/partner/demoPartnerAnalytics.ts'

test('every period uses the same aggregate counts in the chart and metric cards', () => {
  for (const period of reportingPeriods) {
    const report = getDemoPartnerReport(period)
    for (const choice of ['yes', 'no', 'veto']) assert.equal(report.totals[choice], report.buckets.reduce((total, row) => total + row[choice], 0))
    for (const row of report.buckets) {
      assert.ok(row.start >= period.start && row.end <= period.end)
      for (const choice of ['yes', 'no', 'veto']) assert.ok(Number.isInteger(row[choice]) && row[choice] >= 0)
    }
    assert.ok(report.totals.dinnerClicks <= report.totals.dinnerViews)
    assert.ok(report.totals.mocktailClicks <= report.totals.mocktailViews)
    assert.ok(report.totals.wins <= report.totals.yes)
  }
  const month = getDemoPartnerReport(reportingPeriods[0])
  assert.deepEqual(month.buckets.map(row => [row.yes, row.no, row.veto]), [[135, 69, 36], [170, 78, 30], [188, 89, 24], [219, 90, 27]])
  assert.equal(month.totals.yes, 712)
  assert.equal(voteCount(month.totals), 1155)
  assert.equal(percentage(month.totals.veto, voteCount(month.totals)).toFixed(1), '10.1')
  assert.equal(percentage(month.totals.dinnerClicks, month.totals.dinnerViews).toFixed(1), '15.1')
})

test('seven-day report contains precisely the selected dates and a separate prior comparison', () => {
  const week = getDemoPartnerReport(reportingPeriods[1])
  assert.equal(week.buckets.length, 7)
  assert.equal(week.buckets[0].start, '2026-09-02')
  assert.equal(week.buckets.at(-1).end, '2026-09-08')
  assert.ok(week.previous && week.previous.yes > 0)
  assert.ok(week.totals.yes < getDemoPartnerReport(reportingPeriods[0]).totals.yes)
})

test('missing samples and unknown restaurant scopes have empty reports, never invented activity', () => {
  for (const report of [getDemoPartnerReport(reportingPeriods[2]), getDemoPartnerReport(reportingPeriods[0], false)]) {
    assert.equal(report.hasData, false)
    assert.equal(report.previous, null)
    assert.deepEqual(report.buckets, [])
    assert.ok(Object.values(report.totals).every(value => value === 0))
    assert.equal(percentage(0, 0), null)
  }
})

test('CSV labels its source and exports only the currently selected demo figures', () => {
  for (const period of reportingPeriods.slice(0, 2)) {
    const report = getDemoPartnerReport(period)
    const csv = partnerReportCsv(report)
    const rows = csv.trim().split('\r\n').map(line => line.slice(1, -1).split('","'))
    assert.equal(rows.length, report.buckets.length + 4)
    assert.ok(rows.every(row => row.length === 18))
    const [header, summary, ...rest] = rows
    assert.equal(header[0], 'data_source')
    assert.ok(rest.every(row => row[2] === period.start && row[3] === period.end))
    assert.match(summary[0], /Demonstration data/)
    assert.equal(Number(summary[9]), report.totals.yes)
    assert.equal(Number(summary[12]), voteCount(report.totals))
    assert.equal(Number(rest.at(-2)[15]), report.totals.dinnerViews)
    assert.equal(Number(rest.at(-1)[16]), report.totals.mocktailClicks)
    assert.ok(!csv.includes('prior'))
  }
})
