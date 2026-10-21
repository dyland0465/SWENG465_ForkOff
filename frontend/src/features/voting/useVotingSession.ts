import { createContext, useContext } from 'react'
import type { Dispatch } from 'react'
import { emptyVotingSession } from './votingSession'
import type { VotingAction, VotingSession } from './votingSession'

export type SessionAction = { lobbyId: string; action: VotingAction }
export const VotingContext = createContext<{
  sessions: ReadonlyMap<string, VotingSession>
  dispatch: Dispatch<SessionAction>
} | null>(null)

export function useVotingSession(lobbyId: string) {
  const context = useContext(VotingContext)
  if (!context) throw new Error('Voting requires VotingSessionProvider.')
  return {
    session: context.sessions.get(lobbyId) ?? emptyVotingSession,
    dispatch: (action: VotingAction) => context.dispatch({ lobbyId, action }),
  }
}
