import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { generatePath } from 'react-router'
import { Button } from '../../components/ui/Button'
import { SelectField, TextInput } from '../../components/ui/FormField'
import { TextAction } from '../../components/ui/TextAction'
import { paths } from '../../routes/paths'
import { useAuth } from '../auth/useAuth'
import { inviteSavedGroup, listSavedGroups, saveLobbyGroup } from './savedApi'
import type { SavedGroup } from './savedApi'
import './group-controls.css'

type GroupControlsProps = {
  lobbyId: string
  lobbyName?: string
  isHost: boolean
  canInvite?: boolean
  initialGroupId?: string
  onInvitationSent?: (message: string) => void
}

function HostGroupControls({ lobbyId, lobbyName, canInvite = true, initialGroupId, onInvitationSent }: GroupControlsProps) {
  const [groups, setGroups] = useState<SavedGroup[]>([])
  const [selected, setSelected] = useState(initialGroupId ?? '')
  const [name, setName] = useState((lobbyName || 'My dinner crew').slice(0, 80))
  const [saved, setSaved] = useState<{ group: SavedGroup; excludedGuests: number } | null>(null)
  const [message, setMessage] = useState('')
  const [actionError, setActionError] = useState('')
  const [listError, setListError] = useState('')
  const [listLoading, setListLoading] = useState(true)
  const [reload, setReload] = useState(0)
  const [busy, setBusy] = useState<'save' | 'invite' | null>(null)
  const pending = useRef(false)
  const lastSaved = useRef<SavedGroup | null>(null)

  useEffect(() => {
    let active = true
    listSavedGroups().then(result => {
      if (!active) return
      const created = lastSaved.current
      const available = created && !result.groups.some(group => group._id === created._id) ? [created, ...result.groups] : result.groups
      setGroups(available)
      setSelected(current => available.some(group => group._id === current) || (current && current === initialGroupId) ? current : available[0]?._id ?? '')
    }).catch(error => {
      if (active) setListError(error instanceof Error ? error.message : 'Could not load your saved groups.')
    }).finally(() => { if (active) setListLoading(false) })
    return () => { active = false }
  }, [reload, initialGroupId])

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (pending.current || saved || !name.trim()) return
    pending.current = true
    setBusy('save')
    setActionError('')
    setMessage('')
    try {
      const result = await saveLobbyGroup(name.trim(), lobbyId)
      lastSaved.current = result.group
      setSaved(result)
      setGroups(current => [result.group, ...current.filter(group => group._id !== result.group._id)])
      setSelected(result.group._id)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not save this group. Please try again.')
    } finally {
      pending.current = false
      setBusy(null)
    }
  }

  async function invite() {
    if (pending.current || !selected || !canInvite) return
    pending.current = true
    setBusy('invite')
    setActionError('')
    setMessage('')
    try {
      const { invited } = await inviteSavedGroup(selected, lobbyId)
      const feedback = invited
        ? `Invitation request completed for ${invited} saved ${invited === 1 ? 'member' : 'members'} not already in this lobby. Existing invitations and responses are kept. Members choose whether to join.`
        : 'No new invitations are needed. This group has no other saved members, or they are already in this lobby.'
      setMessage(feedback)
      onInvitationSent?.(feedback)
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Could not invite this group. Please try again.')
    } finally {
      pending.current = false
      setBusy(null)
    }
  }

  const selectedGroup = groups.find(group => group._id === selected)
  return <section className="group-controls" aria-labelledby="save-crew-heading">
    <div className="group-controls__heading">
      <h2 id="save-crew-heading">Save your crew</h2>
      <p>Keep this crew handy for your next dinner decision.</p>
    </div>
    {saved ? <div className="group-controls__success">
      <p role="status"><strong>{saved.group.name} is saved.</strong> {saved.group.members.length} other signed-in {saved.group.members.length === 1 ? 'member' : 'members'} saved.{saved.excludedGuests > 0 ? ` ${saved.excludedGuests} ${saved.excludedGuests === 1 ? 'guest was' : 'guests were'} excluded.` : ''}</p>
      <TextAction to={generatePath(paths.groupDetails, { groupId: saved.group._id })}>View saved group</TextAction>
    </div> : <form className="group-controls__save" onSubmit={event => void save(event)}>
      <TextInput label="Group name" value={name} maxLength={80} required onChange={event => setName(event.target.value)} />
      <Button type="submit" disabled={!!busy || !name.trim()}>{busy === 'save' ? 'Saving group…' : 'Save This Group'}</Button>
    </form>}
    <p className="group-controls__note">Only other signed-in lobby members are saved. Guests are excluded. A saved group is a snapshot, so future lobby changes won’t update it.</p>
    {canInvite && <details className="group-controls__reuse" open={!!initialGroupId}>
      <summary>Invite a saved group to this lobby</summary>
      {listLoading ? <p role="status">Loading your groups…</p> : listError ? <div>
        <p role="alert">{listError}</p>
        <TextAction onClick={() => { setListLoading(true); setListError(''); setReload(value => value + 1) }}>Retry loading groups</TextAction>
      </div> : groups.length ? <div className="group-controls__invite">
        <SelectField label="Saved group" value={selected} onChange={event => setSelected(event.target.value)}>
          {selected && !selectedGroup && <option value={selected} disabled>Selected group unavailable</option>}
          {groups.map(group => <option key={group._id} value={group._id}>{group.name} ({group.members.length} saved)</option>)}
        </SelectField>
        <Button variant="secondary" disabled={!!busy || !selected || !selectedGroup?.members.length} onClick={() => void invite()}>{busy === 'invite' ? 'Sending invitations…' : 'Invite to this lobby'}</Button>
        {selectedGroup && !selectedGroup.members.length && <p className="group-controls__note">This group has no other saved members to invite. Share the lobby code instead.</p>}
        <p className="group-controls__note">Members already here are skipped. Retrying keeps existing invitations and their responses; it doesn’t add duplicate invitations or reopen declined ones.</p>
      </div> : <p>No saved groups yet. Save this crew above to keep it for next time.</p>}
      {!listLoading && !listError && selected && !selectedGroup && <p role="alert">The selected saved group is unavailable. Choose another group, or share this lobby’s code instead.</p>}
    </details>}
    {actionError && <p className="group-controls__error" role="alert">{actionError}</p>}
    {message && <p className="group-controls__feedback" role="status">{message}</p>}
  </section>
}

export function GroupControls(props: GroupControlsProps) {
  const { user } = useAuth()
  if (!user || !props.isHost) return null
  return <HostGroupControls key={`${user.id}:${props.lobbyId}`} {...props} />
}
