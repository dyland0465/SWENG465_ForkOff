import { createContext, useContext } from 'react'

// Both conditions are required: setting the flag in a production build cannot enable this.
export const partnerDemoEnabled = import.meta.env.DEV && import.meta.env.VITE_ENABLE_PARTNER_DEMO === 'true'
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
