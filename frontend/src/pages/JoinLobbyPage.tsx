import { generatePath, useNavigate } from 'react-router'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { Button } from '../components/ui/Button'
import { TextAction } from '../components/ui/TextAction'
import { TextInput } from '../components/ui/FormField'
import { ForkEmblem } from '../components/lobby/ForkEmblem'
import { useLobbyForm } from '../components/lobby/useLobbyForm'
import { validateCode, validateDisplayName } from '../components/lobby/lobbyForm'
import { paths } from '../routes/paths'
import './LobbyForms.css'

export function JoinLobbyPage() {
  const navigate = useNavigate()
  const { values, errors, setValue, onBlur, validate } = useLobbyForm(
    { code: '', displayName: '' },
    { code: validateCode, displayName: validateDisplayName },
  )
  const [status, setStatus] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasJoined, setHasJoined] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!validate(event.currentTarget)) {
      setStatus('Check the highlighted fields before continuing.')
      return
    }

    setIsSubmitting(true)
    setStatus('Joining as a guest…')
    try {
      const response = await fetch(`/api/lobbies/${encodeURIComponent(values.code.trim().toUpperCase())}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: values.displayName.trim() }),
      })
      const result = await response.json().catch(() => ({})) as {
        message?: string
        member?: { guestId?: string }
        lobby?: { id?: string; name?: string; lobbyCode?: string }
      }

      if (!response.ok) {
        throw new Error(result.message || 'Could not join the lobby.')
      }

      if (!result.lobby?.id) throw new Error('The server did not return a lobby ID.')
      if (!result.member?.guestId) throw new Error('The server did not return a guest ID.')
      try { sessionStorage.setItem(`lobby-member:${result.lobby.id}`, JSON.stringify({ guestId: result.member.guestId })) } catch { /* Navigation state retains identity for this visit. */ }
      setHasJoined(true)
      navigate(generatePath(paths.lobby, { lobbyId: result.lobby.id }), { state: { member: { guestId: result.member.guestId } } })
      setStatus(`Joined ${result.lobby?.name ?? 'the lobby'} as a guest.`)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Could not join the lobby. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main id="main-content" className="lobby-form-page" tabIndex={-1}>
      <h1 className="text-heading-h1">Join dinner crew</h1>
      <p className="lobby-form-page__intro text-body-large">Enter your invitation code to help choose your crew’s restaurant.</p>
      <div className="join-lobby lobby-panel">
        <div className="join-lobby__invitation">
          <div className="join-lobby__crew">
            <h2 className="text-heading-h2">Your dinner crew</h2>
            <p>Join with an invitation code and display name; no account is needed.</p>
          </div>
          <ForkEmblem />
        </div>
        <div className="join-lobby__members">
          <div className="join-lobby__avatars" aria-hidden="true"><span>?</span><span>?</span><span>?</span></div>
          <p>{hasJoined ? `Welcome, ${values.displayName.trim()}!` : 'Enter a code to join the dinner crew'}</p>
        </div>
        <form className="join-lobby__form" noValidate onSubmit={submit} onChange={() => { setStatus(''); setHasJoined(false) }}>
          <TextInput label="Invitation code" name="code" required autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="Six letters or numbers" value={values.code} error={errors.code} onChange={event => setValue('code', event.target.value.toUpperCase())} onBlur={() => onBlur('code')} />
          <TextInput label="Display name" name="displayName" required autoComplete="nickname" placeholder="Your name" value={values.displayName} error={errors.displayName} onChange={event => setValue('displayName', event.target.value)} onBlur={() => onBlur('displayName')} />
          <Button type="submit" disabled={isSubmitting || hasJoined} aria-describedby="join-backend-note">
            {isSubmitting ? 'Joining…' : hasJoined ? 'Joined as guest' : 'Join as guest'}
          </Button>
          <p id="join-backend-note" className="lobby-form-note">No account is needed; your display name is saved as a guest member.</p>
          <p className="lobby-form-status" role="status">{status}</p>
        </form>
        <p className="join-lobby__privacy">By joining, your name and presence are visible to this lobby. Your individual votes remain private.</p>
        <div className="join-lobby__help">Invite not working? Check the full link or ask your host for the six-character lobby code.</div>
      </div>
      <TextAction className="lobby-form-page__back" to={paths.home}>Back to home</TextAction>
    </main>
  )
}
