import { useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Button } from '../components/ui/Button'
import { Dialog } from '../components/ui/Dialog'
import { useAuth } from '../features/auth/useAuth'
import { GroupsIntroduction } from '../features/saved/GroupsIntroduction'
import { deleteSavedGroup } from '../features/saved/savedApi'
import { useSavedGroups } from '../features/saved/useSavedGroups'
import { paths } from '../routes/paths'
import '../features/saved/groups.css'

function GroupDetailsScreen() {
  const { groupId } = useParams()
  const { user, loading: authLoading } = useAuth()
  const { data, loading, error, reload } = useSavedGroups()
  const navigate = useNavigate()
  const [confirming, setConfirming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')
  const lock = useRef(false)
  const group = data?.groups.find(item => item._id === groupId)

  async function remove() {
    if (!group || lock.current) return
    lock.current = true; setDeleting(true); setDeleteError('')
    try {
      await deleteSavedGroup(group._id)
      navigate(paths.groups, { replace: true, state: { groupNotice: `${group.name} deleted. Associated invitations have been removed.` } })
    } catch (problem) {
      setDeleteError(problem instanceof Error ? problem.message : 'Could not delete this group. Please try again.')
    } finally {
      lock.current = false; setDeleting(false)
    }
  }

  return <main id="main-content" tabIndex={-1} className="groups-page group-details">
    {authLoading ? <><h1>Group details</h1><p role="status">Checking your session…</p></> : !user ? <GroupsIntroduction /> : <>
      <Link className="groups-text-link" to={paths.groups}>Back to all groups</Link>
      {loading ? <><h1>Group details</h1><p role="status">Loading your group…</p></> : error ? <div className="groups-panel groups-feedback"><h1>Could not load this group</h1><p role="alert">{error}</p><Button variant="secondary" onClick={reload}>Retry loading groups</Button></div> : !group ? <div className="groups-panel groups-empty"><h1>Group unavailable</h1><p>This group may have been deleted, or it isn’t saved to your account.</p><Link className="ui-button ui-button--primary" to={paths.groups}>View your groups</Link></div> : <>
        <header className="groups-page__intro"><p className="groups-page__eyebrow">Your saved dinner crew</p><h1>{group.name}</h1><p>{group.members.length} saved {group.members.length === 1 ? 'member' : 'members'}, plus you. A familiar crew for a fresh dinner decision.</p></header>
        <div className="group-details__layout">
          <section className="groups-panel" aria-labelledby="group-members"><h2 id="group-members">Saved members</h2><p className="groups-page__note">Display names from the lobby when you saved this group. You’re its owner and aren’t included in the count.</p>
            {group.members.length ? <ul className="group-members">{group.members.map(member => <li key={member.userId}>{member.displayName}</li>)}</ul> : <p className="groups-quiet-empty">No other signed-in members were saved. You can still start a lobby and share its code.</p>}
          </section>
          <aside className="groups-panel group-details__reuse" aria-labelledby="group-reuse"><h2 id="group-reuse">Bring your crew back</h2><p>Choose your location, date, time, and food preferences as usual. Once the lobby is created, saved members can receive invitations and decide whether to join.</p><Link className="ui-button ui-button--primary" to={`${paths.createLobby}?group=${encodeURIComponent(group._id)}`}>Start a Lobby with This Group</Link><p className="groups-page__note">A saved group is a snapshot, not a permanent chat room. Guests aren’t saved, and members aren’t added automatically.</p></aside>
        </div>
        <section className="groups-panel group-details__danger" aria-labelledby="delete-group"><div><h2 id="delete-group">Delete this group</h2><p>Remove this saved crew and its associated invitations. Existing lobbies and your friends’ accounts stay as they are.</p></div><Button variant="secondary" className="groups-danger-button" onClick={() => { setDeleteError(''); setConfirming(true) }}>Delete Group</Button></section>
        {confirming && <Dialog title="Delete saved group?" closeLabel="Cancel" focusClose busy={deleting} onClose={() => setConfirming(false)}><p>Delete <strong>{group.name}</strong>? This removes the saved group and all invitations associated with it. You can save a new group from a lobby you host.</p><p>Existing lobbies and accounts won’t be deleted.</p>{deleteError && <p className="groups-error" role="alert">{deleteError}</p>}<Button disabled={deleting} className="groups-danger-button" variant="secondary" onClick={() => void remove()}>{deleting ? 'Deleting…' : 'Delete Group'}</Button></Dialog>}
      </>}
    </>}
  </main>
}

export function GroupDetailsPage() {
  const { groupId } = useParams()
  const { user } = useAuth()
  return <GroupDetailsScreen key={`${user?.id ?? 'guest'}:${groupId}`} />
}
