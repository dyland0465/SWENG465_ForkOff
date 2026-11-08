import { lobbyRequest } from '../lobby/liveLobby'
export type Collection = { _id: string; name: string; placeIds: string[] }
export type SavedGroup = { _id: string; name: string; members: { userId: string; displayName: string }[] }
export type Invitation = { id: string; lobbyId: string; lobbyName: string; lobbyCode: string }
export const savedRequest = <T,>(path: string, method = 'GET', body?: unknown) => lobbyRequest<T>(`/api/saved${path}`, method, body)

export const listSavedGroups = () => savedRequest<{ groups: SavedGroup[] }>('/groups')
export const saveLobbyGroup = (name: string, lobbyId: string) =>
  savedRequest<{ group: SavedGroup; excludedGuests: number }>('/groups', 'POST', { name, lobbyId })
export const deleteSavedGroup = (groupId: string) =>
  savedRequest<{ ok: boolean }>(`/groups/${encodeURIComponent(groupId)}`, 'DELETE')
export const inviteSavedGroup = (groupId: string, lobbyId: string) =>
  savedRequest<{ invited: number }>(`/groups/${encodeURIComponent(groupId)}/invitations`, 'POST', { lobbyId })
export const listGroupInvitations = () => savedRequest<{ invitations: Invitation[] }>('/invitations')
export const declineGroupInvitation = (invitationId: string) =>
  savedRequest<{ ok: boolean }>(`/invitations/${encodeURIComponent(invitationId)}`, 'DELETE')
export const joinGroupInvitation = (lobbyId: string) =>
  lobbyRequest(`/api/lobbies/${encodeURIComponent(lobbyId)}/join`, 'POST', {})
