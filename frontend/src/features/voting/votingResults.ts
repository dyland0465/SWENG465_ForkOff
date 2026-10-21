import type { VotingDecision, VotingSession } from './votingSession'

/** Local projection only. A Yes is eligible; equal Yes choices share rank 1.
 * Skips and unprocessed entries have no vote. No/Veto entries cannot be chosen.
 * Input order breaks display ties, never declares a group winner.
 */
export function calculateVotingResults<T extends { id: string }>(restaurants: readonly T[], session: VotingSession) {
  const decisions = new Map(session.history.map(entry => [entry.restaurantId, entry.decision]))
  const counts: Record<VotingDecision, number> = { yes: 0, no: 0, veto: 0, skip: 0 }
  const rows = restaurants.map(restaurant => {
    const decision = decisions.get(restaurant.id) ?? null
    if (decision) counts[decision]++
    return { restaurant, decision, rank: decision === 'yes' ? 1 : null }
  }).sort((a, b) => Number(b.decision === 'yes') - Number(a.decision === 'yes'))
  const processed = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return {
    rows, counts, processed,
    total: restaurants.length,
    votes: counts.yes + counts.no + counts.veto,
    remaining: restaurants.length - processed,
    complete: restaurants.length > 0 && processed === restaurants.length,
    eligible: rows.filter(row => row.decision === 'yes'),
  }
}
