import { Link, generatePath, useLocation } from 'react-router'
import { Button } from '../components/ui/Button'
import { useAuth } from '../features/auth/useAuth'
import { GroupsIntroduction } from '../features/saved/GroupsIntroduction'
import { GroupInvitations } from '../features/saved/GroupInvitations'
import { useSavedGroups } from '../features/saved/useSavedGroups'
import { paths } from '../routes/paths'
import '../features/saved/groups.css'

export function GroupsPage() {
  const { user, loading: authLoading } = useAuth()
  const { data, loading, error, reload } = useSavedGroups()
  const notice = useLocation().state?.groupNotice as string | undefined

  return <main id="main-content" tabIndex={-1} className="groups-page">
    {authLoading ? <><h1>Groups</h1><p role="status">Checking your session…</p></> : !user ? <GroupsIntroduction /> : <>
      <header className="groups-page__intro"><p className="groups-page__eyebrow">Dinner, together</p><h1>Your Groups</h1><p>Save your dinner crew once. Choose a group to start the next lobby and invite everyone back.</p></header>
      {notice && <p role="status" className="groups-success">{notice}</p>}
      <section aria-labelledby="saved-groups-heading">
        <div className="groups-section-heading"><div><h2 id="saved-groups-heading">Saved groups {data && <span className="groups-count">{data.groups.length}</span>}</h2><p>Your saved members are a snapshot of a lobby you hosted.</p></div><Link className="groups-text-link" to={paths.createLobby}>Create a Lobby</Link></div>
        {loading && <div className="groups-panel"><p role="status">Loading your groups…</p></div>}
        {error && <div className="groups-panel groups-feedback"><p role="alert">Could not load your groups. {error}</p><Button variant="secondary" onClick={reload}>Retry loading groups</Button></div>}
        {data && (data.groups.length ? <ul className="groups-grid">{data.groups.map(group => <li key={group._id} className="group-card">
          <div className="group-card__content"><p className="group-card__count">{group.members.length} saved {group.members.length === 1 ? 'member' : 'members'} · plus you</p><h3>{group.name}</h3>
            <p className="group-card__preview">{group.members.length ? group.members.slice(0, 4).map(member => member.displayName).join(', ') : 'No other signed-in members saved.'}{group.members.length > 4 && `, and ${group.members.length - 4} more`}</p>
          </div>
          <div className="groups-actions"><Link className="ui-button ui-button--primary" to={`${paths.createLobby}?group=${encodeURIComponent(group._id)}`} aria-label={`Start a Lobby with ${group.name}`}>Start a Lobby</Link><Link className="groups-text-link" to={generatePath(paths.groupDetails, { groupId: group._id })} aria-label={`View Group: ${group.name}`}>View Group</Link></div>
        </li>)}</ul> : <div className="groups-panel groups-empty"><h3>Your next dinner crew starts here</h3><p>Save a group from a lobby you host, then bring everyone back next time.</p><ol className="groups-steps"><li>Start or join a lobby.</li><li>Have signed-in friends join you.</li><li>As the signed-in host, save the crew for next time.</li></ol><Link className="ui-button ui-button--primary" to={paths.createLobby}>Create a Lobby</Link><p className="groups-page__note">Only signed-in friends are saved. Guests can always join with a code.</p></div>)}
      </section>
      <GroupInvitations key={user.id} />
    </>}
  </main>
}
