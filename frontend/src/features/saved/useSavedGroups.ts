import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { listGroupInvitations, listSavedGroups } from './savedApi'

/** Data stays tied to the verified account, including during logout/account changes. */
function useOwnedResource<T>(load: () => Promise<T>) {
  const { user } = useAuth()
  const ownerId = user?.id
  const [revision, setRevision] = useState(0)
  const [result, setResult] = useState<{ ownerId: string; revision: number; data?: T; error?: string }>()
  const reload = useCallback(() => setRevision(value => value + 1), [])

  useEffect(() => {
    if (!ownerId) return
    let active = true
    void load().then(data => {
      if (active) setResult({ ownerId, revision, data })
    }).catch(error => {
      if (active) setResult({ ownerId, revision, error: error instanceof Error ? error.message : 'Please try again.' })
    })
    return () => { active = false }
  }, [ownerId, revision, load])

  const current = result?.ownerId === ownerId && result?.revision === revision ? result : undefined
  return { data: current?.data, error: current?.error, loading: Boolean(ownerId && !current), reload }
}

export const useSavedGroups = () => useOwnedResource(listSavedGroups)
export const useGroupInvitations = () => useOwnedResource(listGroupInvitations)
