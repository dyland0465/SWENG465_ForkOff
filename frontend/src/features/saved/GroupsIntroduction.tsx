import { Link } from 'react-router'
import { paths } from '../../routes/paths'
import '../../components/ui/Button.css'

export function GroupsIntroduction() {
  return <>
    <header className="groups-page__intro">
      <p className="groups-page__eyebrow">Saved Groups</p>
      <h1>Same crew. Next dinner.</h1>
      <p>Keep your dinner crew close. A free account makes getting everyone together for the next vote a little easier.</p>
    </header>
    <section className="groups-panel groups-introduction" aria-labelledby="groups-benefits">
      <h2 id="groups-benefits">Less setup. More time together.</h2>
      <ol className="groups-steps">
        <li><strong>Save your regulars</strong><p>As a signed-in host, save the signed-in people from your lobby for next time.</p></li>
        <li><strong>Start with your crew</strong><p>Choose a saved group, then set the location, time, and food preferences in the usual lobby form.</p></li>
        <li><strong>Send the next invitation</strong><p>Invite saved members to your new lobby. Everyone still chooses whether to join.</p></li>
      </ol>
      <div className="groups-actions">
        <Link className="ui-button ui-button--primary" to={paths.login} state={{ mode: 'register', from: paths.groups }}>Create an Account</Link>
        <Link className="ui-button ui-button--secondary" to={paths.login} state={{ mode: 'login', from: paths.groups }}>Log In</Link>
      </div>
      <p className="groups-page__note">Already in a lobby as a guest? Finish your session before signing in. Your guest membership and host role won’t transfer to your account.</p>
    </section>
    <aside className="groups-guest-path" aria-label="Continue as a guest">
      <strong>Dinner doesn’t need an account.</strong>
      <p>You can always create a lobby or join with a code as a guest.</p>
      <div className="groups-actions"><Link to={paths.createLobby}>Create a Lobby</Link><Link to={paths.joinLobby}>Join with a Code</Link></div>
    </aside>
  </>
}
