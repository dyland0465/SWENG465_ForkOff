import { useState } from 'react'
import { Navigate, Outlet } from 'react-router'
import { paths } from '../../routes/paths'
import { DemoPreviewContext, partnerDemoEnabled, partnerDemoStorageKey, usePartnerDemoPreview } from './partnerDemoPreviewState'

function readPreview() {
  if (!partnerDemoEnabled) return false
  try { return sessionStorage.getItem(partnerDemoStorageKey) === 'active' } catch { return false }
}

/** Tab-scoped synthetic preview only. This state never represents authentication. */
export function PartnerDemoPreviewProvider() {
  const [active, setActive] = useState(readPreview)

  function start() {
    if (!partnerDemoEnabled) return
    try { sessionStorage.setItem(partnerDemoStorageKey, 'active') } catch { /* Navigation still works without storage. */ }
    setActive(true)
  }

  function exit() {
    try { sessionStorage.removeItem(partnerDemoStorageKey) } catch { /* Clear in-memory access even when storage is blocked. */ }
    setActive(false)
  }

  return <DemoPreviewContext.Provider value={{ active: partnerDemoEnabled && active, start, exit }}><Outlet /></DemoPreviewContext.Provider>
}

/** Demonstration UX only; the backend must secure every future private endpoint. */
export function RequirePartnerDemoPreview() {
  const { active } = usePartnerDemoPreview()
  return active ? <Outlet /> : <Navigate to={paths.partnerAccess} replace />
}
