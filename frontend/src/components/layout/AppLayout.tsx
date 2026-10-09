import { useState } from 'react'
import { Outlet, useNavigate } from 'react-router'
import { Dialog } from '../ui/Dialog'
import { AppHeader } from './AppHeader'
import { paths } from '../../routes/paths'

export function AppLayout() {
  const [showHowItWorks, setShowHowItWorks] = useState(false)
  const navigate = useNavigate()

  return (
    <>
      {/* Reuse the original Home canvas so its dimensions and cropping stay unchanged. */}
      <div className="home-screen">
        <AppHeader
          onHowItWorks={() => setShowHowItWorks(true)}
          onJoinLobby={() => navigate(paths.joinLobby)}
        />
        <Outlet />
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
