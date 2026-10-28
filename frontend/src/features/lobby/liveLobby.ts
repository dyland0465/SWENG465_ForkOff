import { createContext, useContext } from 'react'

export type LobbyMember = { memberId: string; type: 'user' | 'guest'; userId?: string; displayName: string; joinOrder: number; online: boolean }
export type LobbyFilters = { location?: string; dinnerAt?: string; maxDistance?: number; minimumRating?: number; categories?: string[]; priceLevels?: string[]; diningNeeds?: string[]; openNow?: boolean }
export type LiveLobby = { id: string; name: string; lobbyCode: string; status: string; revision: number; roundId: string | null; hostMemberId: string | null; selfMemberId: string; isHost: boolean; members: LobbyMember[]; filters: LobbyFilters }
export type ChatMessage = { id: string; memberId: string; senderName: string; text: string; createdAt: string; requestId: string }
export async function lobbyRequest<T>(url: string, method = 'GET', body?: unknown): Promise<T> {
  const response = await fetch(url, { method, ...(body === undefined ? {} : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }) })
  const result = await response.json()
  if (!response.ok) throw new Error(result.message || 'Request failed. Please try again.')
  return result
}
export type LobbyContextValue = {
  lobby: LiveLobby | null; error: string; notice: string; connection: string; messages: ChatMessage[]; nextCursor: string | null;
  refresh: () => void; mutate: (path: string, method: string, body?: unknown) => Promise<void>;
  sendMessage: (text: string, requestId: string) => Promise<void>; loadOlder: () => Promise<void>;
}
export const LiveLobbyContext = createContext<LobbyContextValue | null>(null)
export function useLiveLobby() {
  const value = useContext(LiveLobbyContext)
  if (!value) throw new Error('Lobby connection is unavailable.')
  return value
}
export function mergeMessages(current: ChatMessage[], incoming: ChatMessage[]) {
  const byId = new Map(current.map(message => [message.id, message]))
  for (const message of incoming) byId.set(message.id, message)
  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id))
}
