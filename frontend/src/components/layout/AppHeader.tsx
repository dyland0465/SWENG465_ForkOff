import wordmark from '../../assets/figma/wordmark.png'
import { TextAction } from '../ui/TextAction'
import './AppHeader.css'

type AppHeaderProps = {
  onHowItWorks: () => void
  onJoinLobby: () => void
  onLogin: () => void
  onSignUp: () => void
}

export function AppHeader({ onHowItWorks, onJoinLobby, onLogin, onSignUp }: AppHeaderProps) {
  return (
    <header className="app-header">
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="app-header__inner">
        <a className="app-header__brand" href="./" aria-label="Fork Off home">
          <img src={wordmark} width="793" height="366" alt="" />
        </a>
        <nav className="app-header__nav" aria-label="Main navigation">
          <TextAction href="./" tone="nav" current>Home</TextAction>
          <TextAction tone="nav" onClick={onHowItWorks}>How it works</TextAction>
          <TextAction tone="nav" onClick={onJoinLobby}>Enter lobby code</TextAction>
          <TextAction tone="nav" onClick={onLogin}>Login</TextAction>
          <TextAction tone="nav" onClick={onSignUp}>Signup</TextAction>
        </nav>
      </div>
      <div className="app-header__divider" />
    </header>
  )
}
