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
  const { values, errors, setValue, onBlur, validate } = useLobbyForm(
    { code: '', displayName: '' },
    { code: validateCode, displayName: validateDisplayName },
  )
  const [status, setStatus] = useState('')

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setStatus(validate(event.currentTarget)
      ? 'Your code and name are valid. Joining will be available when the backend is connected; the invitation has not been verified.'
      : 'Check the highlighted fields before continuing.')
  }

  return (
    <main id="main-content" className="lobby-form-page" tabIndex={-1}>
      <h1 className="text-heading-h1">Join dinner crew</h1>
      <p className="lobby-form-page__intro text-body-large">Enter your invitation code to help choose your crew’s restaurant.</p>
      <div className="join-lobby lobby-panel">
        <div className="join-lobby__invitation">
          <div className="join-lobby__crew">
            <h2 className="text-heading-h2">Your dinner crew</h2>
            <p>Lobby details will appear once connected.</p>
          </div>
          <ForkEmblem />
        </div>
        <div className="join-lobby__members">
          <div className="join-lobby__avatars" aria-hidden="true"><span>?</span><span>?</span><span>?</span></div>
          <p>Waiting for invitation details</p>
        </div>
        <form className="join-lobby__form" noValidate onSubmit={submit} onChange={() => setStatus('')}>
          <TextInput label="Invitation code" name="code" required autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="Six letters or numbers" value={values.code} error={errors.code} onChange={event => setValue('code', event.target.value.toUpperCase())} onBlur={() => onBlur('code')} />
          <TextInput label="Display name" name="displayName" required autoComplete="nickname" placeholder="Your name" value={values.displayName} error={errors.displayName} onChange={event => setValue('displayName', event.target.value)} onBlur={() => onBlur('displayName')} />
          <Button type="submit" aria-describedby="join-backend-note">Join lobby</Button>
          <p id="join-backend-note" className="lobby-form-note">Joining a lobby is not connected yet.</p>
          <p className="lobby-form-status" role="status">{status}</p>
        </form>
        <p className="join-lobby__privacy">By joining, your name and presence are visible to this lobby. Your individual votes remain private.</p>
        <div className="join-lobby__help">Invite not working? Check the full link or ask your host for the six-character lobby code.</div>
      </div>
      <TextAction className="lobby-form-page__back" to={paths.home}>Back to home</TextAction>
    </main>
  )
}
