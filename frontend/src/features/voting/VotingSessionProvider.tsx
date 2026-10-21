import { useEffect, useReducer } from 'react'
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

const storageKey = 'forkoff:voting:v1'

function restoreSessions(): Map<string, VotingSession> {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(storageKey) ?? '[]')
    if (!Array.isArray(saved)) return new Map()
    const restored = new Map<string, VotingSession>()
    for (const pair of saved) {
      if (!Array.isArray(pair) || typeof pair[0] !== 'string' || !Array.isArray(pair[1]?.history)) continue
      let session = emptyVotingSession
      for (const entry of pair[1].history) {
        if (!entry || !['yes', 'no', 'veto', 'skip'].includes(entry.decision)) break
        session = reduceVotingSession(session, { type: 'process', restaurantId: entry.restaurantId, decision: entry.decision }, restaurantIds)
      }
      restored.set(pair[0], { ...session, feedback: null })
    }
    return restored
  } catch { return new Map() }
}

/** Tab-local demo choices survive refresh and remain isolated by lobby ID. */
export function VotingSessionProvider({ children }: { children: ReactNode }) {
  const [sessions, dispatch] = useReducer(sessionsReducer, undefined, restoreSessions)
  useEffect(() => {
    try { sessionStorage.setItem(storageKey, JSON.stringify([...sessions])) } catch { /* Keep voting available when storage is disabled. */ }
  }, [sessions])
  return <VotingContext value={{ sessions, dispatch }}>{children}</VotingContext>
}

