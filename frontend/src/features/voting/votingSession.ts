export type VoteChoice = 'yes' | 'no' | 'veto'
export type VotingDecision = VoteChoice | 'skip'
export type ProcessedRestaurant = { restaurantId: string; decision: VotingDecision }
export type VotingSession = {
  history: readonly ProcessedRestaurant[]
  feedback: { kind: 'processed' | 'undone'; entry: ProcessedRestaurant } | { kind: 'restarted' } | null
}
export type VotingAction =
  | { type: 'process'; restaurantId: string; decision: VotingDecision }
  | { type: 'undo' }
  | { type: 'restart' }

export const emptyVotingSession: VotingSession = { history: [], feedback: null }

/** Pure transition boundary; skip advances history but never becomes a vote. */
export function reduceVotingSession(session: VotingSession, action: VotingAction, restaurantIds: readonly string[]): VotingSession {
  switch (action.type) {
    case 'process': {
      // Reject stale callbacks, duplicate IDs, and actions after completion.
      if (restaurantIds[session.history.length] !== action.restaurantId
        || session.history.some(entry => entry.restaurantId === action.restaurantId)) return session
      const entry = { restaurantId: action.restaurantId, decision: action.decision }
      return { history: [...session.history, entry], feedback: { kind: 'processed', entry } }
    }
    case 'undo': {
      const entry = session.history.at(-1)
      if (!entry) return session
      return { history: session.history.slice(0, -1), feedback: { kind: 'undone', entry } }
    }
    case 'restart':
      return { history: [], feedback: { kind: 'restarted' } }
  }
}

export function getRecordedVotes(session: VotingSession): readonly (ProcessedRestaurant & { decision: VoteChoice })[] {
  return session.history.filter((entry): entry is ProcessedRestaurant & { decision: VoteChoice } => entry.decision !== 'skip')
}
