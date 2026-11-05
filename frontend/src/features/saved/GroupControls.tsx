import { useEffect, useState } from 'react'
import { useAuth } from '../auth/useAuth'
import { savedRequest } from './savedApi'
import type { SavedGroup } from './savedApi'
import './saved.css'
export function GroupControls({ lobbyId, isHost }: { lobbyId: string; isHost: boolean }) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<SavedGroup[]>([]), [selected, setSelected] = useState(''), [name, setName] = useState(''), [message, setMessage] = useState(''), [busy, setBusy] = useState(false)
  async function refresh() { const data = await savedRequest<{ groups: SavedGroup[] }>('/groups'); setGroups(data.groups); setSelected(current => current || data.groups[0]?._id || '') }
  useEffect(() => { if (user && isHost) void Promise.resolve().then(refresh).catch(() => setMessage('Could not load saved groups.')) }, [user, isHost])
  if (!user || !isHost) return null
  async function save() { setBusy(true); setMessage(''); try { const result = await savedRequest<{ excludedGuests: number }>('/groups', 'POST', { name, lobbyId }); setName(''); await refresh(); setMessage(`Group saved.${result.excludedGuests ? ` ${result.excludedGuests} guest(s) were not saved.` : ''}`) } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save group.') } finally { setBusy(false) } }
  async function invite() { if (!selected) return; setBusy(true); setMessage(''); try { const result = await savedRequest<{ invited: number }>(`/groups/${selected}/invitations`, 'POST', { lobbyId }); setMessage(`Invitations sent to ${result.invited} account(s).`) } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not invite group.') } finally { setBusy(false) } }
  return <section className="saved-control" aria-label="Saved groups"><h2>Saved groups</h2><label>Group name <input value={name} maxLength={80} onChange={e => setName(e.target.value)} /></label><button type="button" disabled={busy || !name.trim()} onClick={() => void save()}>Save this group</button>{groups.length > 0 && <><label>Invite group <select value={selected} onChange={e => setSelected(e.target.value)}>{groups.map(g => <option key={g._id} value={g._id}>{g.name}</option>)}</select></label><button type="button" disabled={busy} onClick={() => void invite()}>Invite to this lobby</button></>}<p>Only signed-in members are saved. Invited people choose whether to join.</p><p role="status">{message}</p></section>
}
