import { Link, useMatch } from 'react-router'
import wordmark from '../../assets/figma/wordmark.png'
import { TextAction } from '../ui/TextAction'
import { paths } from '../../routes/paths'
import './AppHeader.css'

type AppHeaderProps = {
  onHowItWorks: () => void
  onJoinLobby: () => void
}

export function AppHeader({ onHowItWorks, onJoinLobby }: AppHeaderProps) {
  const isHome = useMatch({ path: paths.home, end: true }) !== null

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
        </nav>
      </div>
      <div className="app-header__divider" />
    </header>
  )
}
