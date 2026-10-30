import { createContext, useContext } from 'react'

// Public build-time UI settings, never authentication or a security boundary.
// Optimized builds require a separate staging opt-in; production stays disabled.
export const partnerDemoEnabled = import.meta.env.VITE_ENABLE_PARTNER_DEMO === 'true'
  && (import.meta.env.DEV || import.meta.env.VITE_APP_ENV === 'staging')
export const partnerDemoStorageKey = 'forkoff.partner-demo-preview.v1'

export const DemoPreviewContext = createContext<{
  active: boolean
  start: () => void
  exit: () => void
} | null>(null)

export function usePartnerDemoPreview() {
  const preview = useContext(DemoPreviewContext)
  if (!preview) throw new Error('Partner preview requires PartnerDemoPreviewProvider.')
  return preview
}
