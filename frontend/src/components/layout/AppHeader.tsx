import { useState } from 'react'
import { Link, useLocation, useMatch, useNavigate } from 'react-router'
import wordmark from '../../assets/figma/wordmark.png'
import { TextAction } from '../ui/TextAction'
import { paths } from '../../routes/paths'
import { useAuth } from '../../features/auth/useAuth'
import './AppHeader.css'

type AppHeaderProps = {
  onHowItWorks: () => void
  onJoinLobby: () => void
}

export function AppHeader({ onHowItWorks, onJoinLobby }: AppHeaderProps) {
  const isHome = useMatch({ path: paths.home, end: true }) !== null
  const isLogin = useMatch(paths.login) !== null
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const [logoutError, setLogoutError] = useState('')
  const { user, signOut } = useAuth()
  return (
    <header className="app-header">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="app-header__inner">
        <Link className="app-header__brand" to={paths.home} aria-label="Fork Off home">
          <img src={wordmark} width="793" height="366" alt="" />
        </Link>
        <nav className="app-header__nav" aria-label="Main navigation">
          <TextAction to={paths.home} tone="nav" current={isHome}>Home</TextAction>
          <TextAction tone="nav" onClick={onHowItWorks}>How it works</TextAction>
          <TextAction tone="nav" onClick={onJoinLobby}>Enter lobby code</TextAction>
          {user ? (
            <span className="app-header__account">
              <span className="app-header__user">Hi, {user.username}</span>
              <TextAction tone="nav" onClick={() => { void signOut().then(() => navigate(paths.home)).catch(error => setLogoutError(error.message)) }}>Log out</TextAction>
            </span>
          ) : (
            <TextAction to={paths.login} state={isLogin ? undefined : { from: pathname }} tone="nav" current={isLogin}>Log in</TextAction>
          )}
        </nav>
      </div>
      <div className="app-header__divider" />
      {logoutError && <p role="alert">{logoutError}</p>}
    </header>
  )
}
