import test from 'node:test'
import assert from 'node:assert/strict'
import { calculateVotingResults } from '../src/features/voting/votingResults.ts'
import { emptyVotingSession, reduceVotingSession } from '../src/features/voting/votingSession.ts'

const restaurants = ['ramen', 'harbor', 'bowls'].map(id => ({ id }))
const ids = restaurants.map(r => r.id)
const choices = ['yes', 'no', 'veto', 'skip']

test('every combination of local decisions has accurate counts, eligibility and ties', () => {
  for (const a of choices) for (const b of choices) for (const c of choices) {
    const decisions = [a, b, c]
    let session = emptyVotingSession
    decisions.forEach((decision, i) => { session = reduceVotingSession(session, { type: 'process', restaurantId: ids[i], decision }, ids) })
    const before = structuredClone(session)
    const results = calculateVotingResults(restaurants, session)
    assert.equal(results.complete, true)
    assert.equal(results.processed, 3)
    assert.equal(results.remaining, 0)
    for (const decision of choices) assert.equal(results.counts[decision], decisions.filter(d => d === decision).length)
    assert.equal(results.votes, 3 - results.counts.skip)
    assert.deepEqual(results.eligible.map(row => row.restaurant.id), ids.filter((_, i) => decisions[i] === 'yes'))
    for (const row of results.rows) assert.equal(row.rank, row.decision === 'yes' ? 1 : null)
    assert.deepEqual(session, before, 'projection never changes the voting session')
  }
})

test('empty and incomplete sessions never turn missing or skipped decisions into votes', () => {
  const empty = calculateVotingResults(restaurants, emptyVotingSession)
  assert.equal(empty.complete, false)
  assert.equal(empty.remaining, 3)
  assert.equal(empty.votes, 0)
  assert.ok(empty.rows.every(row => row.decision === null && row.rank === null))
  const partial = calculateVotingResults(restaurants, { history: [{ restaurantId: 'ramen', decision: 'skip' }], feedback: null })
  assert.equal(partial.complete, false)
  assert.equal(partial.remaining, 2)
  assert.equal(partial.votes, 0)
  assert.equal(partial.counts.skip, 1)
})

test('undo and restart immediately remove previous results; unknown restaurants are ignored', () => {
  const session = { history: [{ restaurantId: 'ramen', decision: 'yes' }], feedback: null }
  for (const action of [{ type: 'undo' }, { type: 'restart' }]) {
    const results = calculateVotingResults(restaurants, reduceVotingSession(session, action, ids))
    assert.equal(results.eligible.length, 0)
    assert.equal(results.processed, 0)
  }
  const unknown = calculateVotingResults(restaurants, { history: [{ restaurantId: 'unknown', decision: 'yes' }], feedback: null })
  assert.equal(unknown.processed, 0)
  assert.equal(calculateVotingResults([], emptyVotingSession).complete, false)
})
