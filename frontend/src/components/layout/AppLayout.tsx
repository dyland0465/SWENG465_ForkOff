import { useState } from 'react'
import { Outlet, useMatch, useNavigate } from 'react-router'
import { Dialog } from '../ui/Dialog'
import { AppHeader } from './AppHeader'
import { paths } from '../../routes/paths'
import { VotingSessionProvider } from '../../features/voting/VotingSessionProvider'

export function AppLayout() {
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const navigate = useNavigate()
  const isCreateLobby = useMatch(paths.createLobby) !== null
  const isJoinLobby = useMatch(paths.joinLobby) !== null
  const isLobby = useMatch({ path: paths.lobby, end: true }) !== null
  const isGroupChat = useMatch(paths.groupChat) !== null
  const isDiscovery = useMatch(paths.discoveryPreview) !== null
  const isVoting = useMatch(paths.voting) !== null
  const isRestaurantDetails = useMatch(`${paths.lobby}/restaurants/*`) !== null
  const isResults = useMatch(paths.results) !== null

  return (
    <>
      {/* Reuse the original Home canvas so its dimensions and cropping stay unchanged. */}
      <div className={`home-screen${isCreateLobby || isJoinLobby ? ' lobby-screen' : ''}${isLobby || isGroupChat ? ' lobby-detail-screen' : ''}${isDiscovery || isVoting || isRestaurantDetails || isResults ? ' discovery-screen' : ''}${isVoting ? ' voting-screen' : ''}`}>
        <AppHeader
          onHowItWorks={() => setShowHowItWorks(true)}
          onJoinLobby={() => navigate(paths.joinLobby)}
        />
        <VotingSessionProvider><Outlet /></VotingSessionProvider>
      </div>
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
