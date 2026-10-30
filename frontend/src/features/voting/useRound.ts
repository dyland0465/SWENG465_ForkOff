import { useCallback, useEffect, useState } from 'react'
import { lobbyRequest } from '../lobby/liveLobby'

export type Restaurant = { id: string; name: string; address: string | null; category: string | null; googleMapsUri: string | null; photoUrl: string | null; photoAuthors: { displayName: string; uri?: string }[]; rating?: number | null; ratingCount?: number | null; priceLevel?: string | null; distanceMiles?: number | null; hours?: string[] }
export type Decision = 'yes' | 'no' | 'veto' | 'skip'
export type Round = { id: string; restaurants: Restaurant[]; warnings?: string[]; decisions: Record<string, Decision>; canVote: boolean; completed: number; totalMembers: number; complete: boolean; results: { restaurant: Restaurant; yes: number; no: number; veto: number; skip: number }[] | null }
export function useRound(lobbyId: string) {
  const [round, setRound] = useState<Round | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const base = `/api/lobbies/${encodeURIComponent(lobbyId)}/round`
  const refresh = useCallback(async () => {
    try { const data = await lobbyRequest<{ round: Round | null }>(base); setRound(data.round); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the round.') }
    finally { setLoading(false) }
  }, [base])
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 3000); return () => clearInterval(timer) }, [refresh])
  return { round, loading, error, refresh, base }
}
