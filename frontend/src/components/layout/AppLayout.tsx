import { LiveLobbyProvider } from '../../features/lobby/LiveLobbyProvider'
import { useState } from 'react'
import { Outlet, useLocation, useMatch, useNavigate } from 'react-router'
import { Dialog } from '../ui/Dialog'
import { AppHeader } from './AppHeader'
import { paths } from '../../routes/paths'
import { VotingSessionProvider } from '../../features/voting/VotingSessionProvider'
import { RestaurantPreferencesProvider } from '../../features/preferences/RestaurantPreferencesProvider'
import { RouteNavigation } from './RouteNavigation'

export function AppLayout() {
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const navigate = useNavigate()
  const lobbyNotice = useLocation().state?.lobbyNotice as string | undefined
  const isCreateLobby = useMatch(paths.createLobby) !== null
  const isJoinLobby = useMatch(paths.joinLobby) !== null
  const isLogin = useMatch(paths.login) !== null
  const isLobby = useMatch({ path: paths.lobby, end: true }) !== null
  const isGroupChat = useMatch(paths.groupChat) !== null
  const isDiscovery = useMatch(paths.discoveryPreview) !== null
  const isVoting = useMatch(paths.voting) !== null
  const isRestaurantDetails = useMatch(`${paths.lobby}/restaurants/*`) !== null
  const isResults = useMatch(paths.results) !== null
  const isPartner = useMatch(paths.partnerRestaurant) !== null

  return (
    <>
      {/* Reuse the original Home canvas so its dimensions and cropping stay unchanged. */}
      {/* Login: added `|| isLogin` to reuse the lobby-screen styling, and the
          login-screen class so LoginScreen.css can un-highlight the Home tab. */}
      <div className={`home-screen${isCreateLobby || isJoinLobby || isLogin ? ' lobby-screen' : ''}${isLobby || isGroupChat ? ' lobby-detail-screen' : ''}${isLobby ? ' lobby-page-screen' : ''}${isDiscovery || isVoting || isRestaurantDetails || isResults ? ' discovery-screen' : ''}${isVoting ? ' voting-screen' : ''}${isLogin ? ' login-screen' : ''}`}>        <AppHeader
          onHowItWorks={() => setShowHowItWorks(true)}
          onJoinLobby={() => navigate(paths.joinLobby)}
        />
        <VotingSessionProvider><LiveLobbyProvider>{lobbyNotice && <p className="lobby-global-notice" role="status">{lobbyNotice}</p>}<Outlet /></LiveLobbyProvider></VotingSessionProvider>
      </div>
      <RouteNavigation />
      {showHowItWorks && (
        <Dialog title="How it works" onClose={() => setShowHowItWorks(false)}>
          <ol className="how-it-works">
            <li><strong>Get your crew together.</strong> Create a lobby or join with an invite code.</li>
            <li><strong>Find your options.</strong> Set a location, distance, cuisine, and budget.</li>
            <li><strong>Vote privately.</strong> Say yes, no, or veto. Votes stay hidden until everyone finishes.</li>
            <li><strong>Dinner, decided.</strong> Review the group’s favorites and choose a place to eat.</li>
          </ol>
        </Dialog>
      )}
    </>
  )
}


