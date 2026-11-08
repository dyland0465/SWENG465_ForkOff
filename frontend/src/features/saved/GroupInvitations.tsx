import { useRef, useState } from 'react'
import { generatePath, useNavigate } from 'react-router'
import { Button } from '../../components/ui/Button'
import { paths } from '../../routes/paths'
import { declineGroupInvitation, joinGroupInvitation } from './savedApi'
import type { Invitation } from './savedApi'
import { useGroupInvitations } from './useSavedGroups'

export function GroupInvitations() {
  const { data, loading, error, reload } = useGroupInvitations()
  const navigate = useNavigate()
  const lock = useRef(false)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const [busy, setBusy] = useState('')
  const [actionError, setActionError] = useState('')
  const [message, setMessage] = useState('')

  async function respond(invitation: Invitation, action: 'join' | 'decline') {
    if (lock.current) return
    lock.current = true
    setBusy(invitation.id); setActionError(''); setMessage('')
    try {
      if (action === 'join') {
        await joinGroupInvitation(invitation.lobbyId)
        navigate(generatePath(paths.lobby, { lobbyId: invitation.lobbyId }))
      } else {
        await declineGroupInvitation(invitation.id)
        setMessage(`Invitation to ${invitation.lobbyName} declined.`)
        reload()
        headingRef.current?.focus()
      }
    } catch (problem) {
      setActionError(problem instanceof Error ? problem.message : 'Could not update this invitation. Please try again.')
    } finally {
      lock.current = false; setBusy('')
    }
  }

  return <section className="groups-panel groups-invitations" aria-labelledby="group-invitations">
    <div className="groups-section-heading">
      <div><h2 ref={headingRef} tabIndex={-1} id="group-invitations">Invitations {data && <span className="groups-count">{data.invitations.length}</span>}</h2><p>Your next dinner could start here. Invitations appear while a lobby is waiting for members.</p></div>
      <Button variant="secondary" disabled={loading || Boolean(busy)} onClick={reload} aria-label="Refresh invitations">Refresh</Button>
    </div>
    {loading && <p role="status">Loading invitations…</p>}
    {error && <div className="groups-feedback"><p role="alert">Could not load invitations. {error}</p><Button variant="secondary" onClick={reload}>Retry loading invitations</Button></div>}
    {actionError && <p className="groups-error" role="alert">{actionError} We couldn’t confirm this action. Refresh to check the invitation and lobby.</p>}
    <p className="groups-success" role="status">{message}</p>
    {data && (data.invitations.length ? <ul className="groups-invitation-list">{data.invitations.map(invitation => <li key={invitation.id}>
      <div><h3>{invitation.lobbyName}</h3><p>Lobby code <strong>{invitation.lobbyCode}</strong></p></div>
      <div className="groups-actions">
        <Button disabled={Boolean(busy)} aria-label={`Join Lobby: ${invitation.lobbyName}`} onClick={() => void respond(invitation, 'join')}>{busy === invitation.id ? 'Please wait…' : 'Join Lobby'}</Button>
        <Button variant="secondary" disabled={Boolean(busy)} aria-label={`Decline invitation: ${invitation.lobbyName}`} onClick={() => void respond(invitation, 'decline')}>Decline</Button>
      </div>
    </li>)}</ul> : <div className="groups-quiet-empty"><h3>You’re all caught up</h3><p>No pending invitations. Friends can invite you from a saved group, or share a lobby code.</p></div>)}
  </section>
}
