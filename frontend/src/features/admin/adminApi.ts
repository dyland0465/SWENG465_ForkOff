/**
 * adminApi.ts
 *
 * The functions the admin screen uses to talk to the backend. All of these routes
 * are admin-only on the server (requireRole("admin")), so they fail with 403 for
 * anyone else, even if they find this page.
 *
 *  - listPartners(status)        GET  /api/admin/partners?status=...
 *  - searchPlaces(query)         GET  /api/admin/places?query=...
 *  - approvePartner(id, placeId) POST /api/admin/partners/:id/approve
 *  - rejectPartner(id)           POST /api/admin/partners/:id/reject
 *
 * Each throws an Error with the server's message when something goes wrong.
 */
export type PartnerStatus = 'pending' | 'approved' | 'rejected'
export type PartnerFilter = PartnerStatus | 'all'

export interface AdminPartner {
  id: string
  username: string
  email: string
  status: PartnerStatus
  requestedRestaurant: { name: string; address: string }
  restaurantIds: string[]
  createdAt?: string
}

export interface PlaceResult {
  placeId: string
  name: string
  address: string
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: 'same-origin', cache: 'no-store', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const body = await response.json().catch(() => ({})) as T & { message?: string }
  if (!response.ok) throw new Error(body.message || 'Something went wrong. Please try again.')
  return body
}

export async function listPartners(status: PartnerFilter, signal?: AbortSignal) {
  return (await request<{ partners: AdminPartner[] }>(`/api/admin/partners?status=${encodeURIComponent(status)}`, { signal })).partners
}

export async function searchPlaces(query: string) {
  return (await request<{ places: PlaceResult[] }>(`/api/admin/places?query=${encodeURIComponent(query)}`)).places
}

export async function approvePartner(id: string, placeId: string) {
  return (await request<{ partner: AdminPartner }>(`/api/admin/partners/${encodeURIComponent(id)}/approve`, { method: 'POST', body: JSON.stringify({ placeId }) })).partner
}

export async function rejectPartner(id: string) {
  return (await request<{ partner: AdminPartner }>(`/api/admin/partners/${encodeURIComponent(id)}/reject`, { method: 'POST', body: '{}' })).partner
}