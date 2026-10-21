import { useReducer } from 'react'
import type { ReactNode } from 'react'
import { votingRestaurants } from '../../data/demoRestaurants'
import { emptyVotingSession, reduceVotingSession } from './votingSession'
import type { VotingSession } from './votingSession'
import { VotingContext } from './useVotingSession'
import type { SessionAction } from './useVotingSession'
const restaurantIds = votingRestaurants.map(restaurant => restaurant.id)

function sessionsReducer(sessions: ReadonlyMap<string, VotingSession>, { lobbyId, action }: SessionAction) {
  const previous = sessions.get(lobbyId) ?? emptyVotingSession
  const next = reduceVotingSession(previous, action, restaurantIds)
  return next === previous ? sessions : new Map(sessions).set(lobbyId, next)
}

/** Memory only: survives client-side navigation; refresh clears every demo session. */
export function VotingSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, dispatch] = useReducer(sessionsReducer, new Map<string, VotingSession>())
  return <VotingContext value={{ sessions, dispatch }}>{children}</VotingContext>
}

