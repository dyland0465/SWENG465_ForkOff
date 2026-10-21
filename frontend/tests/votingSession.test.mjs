import test from 'node:test'
import assert from 'node:assert/strict'
import { emptyVotingSession, getRecordedVotes, reduceVotingSession } from '../src/features/voting/votingSession.ts'

const ids = ['ramen', 'harbor', 'bowls']
const process = (state, restaurantId, decision) => reduceVotingSession(state, { type: 'process', restaurantId, decision }, ids)
const undo = state => reduceVotingSession(state, { type: 'undo' }, ids)

test('yes, no, and veto remain distinct; completion rejects further votes', () => {
  let state = emptyVotingSession
  for (const [index, choice] of ['yes', 'no', 'veto'].entries()) state = process(state, ids[index], choice)
  assert.deepEqual(getRecordedVotes(state).map(entry => entry.decision), ['yes', 'no', 'veto'])
  assert.equal(state.history.length, 3)
  assert.equal(process(state, 'bowls', 'yes'), state)
  assert.equal(process(state, 'unknown', 'yes'), state)
})

test('skips advance progress without recording a vote, including all-skipped completion', () => {
  let state = emptyVotingSession
  for (const id of ids) state = process(state, id, 'skip')
  assert.equal(state.history.length, 3)
  assert.deepEqual(getRecordedVotes(state), [])
  assert.equal(undo(state).history.length, 2)
  assert.equal(getRecordedVotes(undo(state)).length, 0)
})

test('undo restores the previous restaurant and removes its vote; replacement is unique', () => {
  const first = process(emptyVotingSession, 'ramen', 'veto')
  const second = process(first, 'harbor', 'no')
  const undone = undo(second)
  assert.deepEqual(undone.history, first.history)
  assert.deepEqual(getRecordedVotes(undone), [{ restaurantId: 'ramen', decision: 'veto' }])
  const replacement = process(undone, 'harbor', 'yes')
  assert.deepEqual(getRecordedVotes(replacement).map(entry => entry.decision), ['veto', 'yes'])
  assert.equal(new Set(replacement.history.map(entry => entry.restaurantId)).size, 2)
})

test('mixed skip and vote history is fully reversible through completion', () => {
  let state = process(emptyVotingSession, 'ramen', 'yes')
  state = process(state, 'harbor', 'skip')
  state = process(state, 'bowls', 'veto')
  assert.equal(getRecordedVotes(state).length, 2)
  state = undo(state)
  assert.deepEqual(state.feedback, { kind: 'undone', entry: { restaurantId: 'bowls', decision: 'veto' } })
  state = undo(state)
  assert.equal(state.history.length, 1)
  assert.equal(getRecordedVotes(state).length, 1)
  state = undo(state)
  assert.deepEqual(state.history, [])
  assert.equal(undo(state), state)
})

test('stale, out-of-order, and duplicate callbacks never advance the session', () => {
  assert.equal(process(emptyVotingSession, 'harbor', 'yes'), emptyVotingSession)
  const first = process(emptyVotingSession, 'ramen', 'no')
  assert.equal(process(first, 'ramen', 'yes'), first)
  assert.equal(process(first, 'ramen', 'skip'), first)
  assert.equal(process(first, 'bowls', 'veto'), first)
  assert.equal(process(first, 'missing', 'yes'), first)
  assert.deepEqual(emptyVotingSession.history, [])
})

test('restart clears decisions, skips, and progress without mutating earlier state', () => {
  const state = process(process(emptyVotingSession, 'ramen', 'yes'), 'harbor', 'skip')
  const restarted = reduceVotingSession(state, { type: 'restart' }, ids)
  assert.equal(restarted.history.length, 0)
  assert.equal(getRecordedVotes(restarted).length, 0)
  assert.equal(restarted.feedback.kind, 'restarted')
  assert.equal(state.history.length, 2)
  assert.equal(process(restarted, 'ramen', 'veto').history.length, 1)
})

test('an empty restaurant list cannot accept any voting action', () => {
  assert.equal(reduceVotingSession(emptyVotingSession, { type: 'process', restaurantId: 'ramen', decision: 'yes' }, []), emptyVotingSession)
  assert.equal(undo(emptyVotingSession), emptyVotingSession)
})
