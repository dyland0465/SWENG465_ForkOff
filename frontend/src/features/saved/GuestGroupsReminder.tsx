import { useEffect, useState } from 'react'
import { TextAction } from '../../components/ui/TextAction'
import { paths } from '../../routes/paths'
import { useAuth } from '../auth/useAuth'
import './GuestGroupsReminder.css'

type ReminderContext = 'home' | 'create' | 'lobby' | 'results'
const dismissalKey = 'forkoff:groups-reminder-dismissed'
const dismissalEvent = 'forkoff:groups-reminder-dismissed'

function wasDismissed() {
  try { return sessionStorage.getItem(dismissalKey) === 'true' } catch { return false }
}

const copy: Record<ReminderContext, { title: string; description: string }> = {
  home: {
    title: 'Same crew every weekend?',
    description: 'Save your dinner group once and invite everyone faster next time.',
  },
  create: {
    title: 'Make next time easier.',
    description: 'Want to use the same crew next time? Create an account to save your group.',
  },
  lobby: {
    title: 'Make the next round easier.',
    description: 'With an account, hosts can save their signed-in crew and invite them back.',
  },
  results: {
    title: 'Same crew next time?',
    description: 'Save your group with a free account and invite them back for another round.',
  },
}

/** A shared dismissal keeps account reminders quiet for the rest of this tab's session. */
export function GuestGroupsReminder({ context }: { context: ReminderContext }) {
  const { user, loading } = useAuth()
  const [dismissed, setDismissed] = useState(wasDismissed)
  useEffect(() => {
    const onDismiss = () => setDismissed(true)
    window.addEventListener(dismissalEvent, onDismiss)
    return () => window.removeEventListener(dismissalEvent, onDismiss)
  }, [])

  if (loading || user || dismissed) return null

  function dismiss() {
    try { sessionStorage.setItem(dismissalKey, 'true') } catch { /* Storage is optional. */ }
    setDismissed(true)
    window.dispatchEvent(new Event(dismissalEvent))
  }

  return (
    <aside className={`guest-groups-reminder guest-groups-reminder--${context}`} aria-label="Saved groups tip">
      <div className="guest-groups-reminder__copy">
        <p><strong>{copy[context].title}</strong> {copy[context].description}</p>
        {(context === 'lobby' || context === 'results') && (
          <p className="guest-groups-reminder__session">Finish this session before signing in; your guest membership won’t transfer.</p>
        )}
        <TextAction to={paths.groups}>Explore Saved Groups</TextAction>
      </div>
      <button type="button" className="guest-groups-reminder__dismiss" aria-label="Dismiss saved groups tips for this session" onClick={dismiss}>
        <span aria-hidden="true">×</span>
      </button>
    </aside>
  )
}
