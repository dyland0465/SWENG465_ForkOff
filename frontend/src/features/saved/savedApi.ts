import { lobbyRequest } from '../lobby/liveLobby'
export type Collection = { _id: string; name: string; placeIds: string[] }
export type SavedGroup = { _id: string; name: string; members: { userId: string; displayName: string }[] }
export type Invitation = { id: string; lobbyId: string; lobbyName: string; lobbyCode: string }
export const savedRequest = <T,>(path: string, method = 'GET', body?: unknown) => lobbyRequest<T>(`/api/saved${path}`, method, body)
