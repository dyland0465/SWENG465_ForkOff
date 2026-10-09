import { useState } from 'react'
import { Dialog } from './components/ui/Dialog'
import { HomeScreen } from './components/home/HomeScreen'
import './App.css'

type HomeDialog = 'how-it-works' | 'create' | 'join'

const availability = {
  create: {
    title: 'Create a lobby',
    message: 'Lobby creation is coming soon. Check back to get your dinner crew together.',
  },
  join: {
    title: 'Join with a code',
    message: 'Joining a lobby is coming soon. Keep your invite code handy for when it opens.',
  },
}

function App() {
  const [dialog, setDialog] = useState<HomeDialog | null>(null)

  return (
    <>
      <HomeScreen
        onCreateLobby={() => setDialog('create')}
        onJoinLobby={() => setDialog('join')}
        onHowItWorks={() => setDialog('how-it-works')}
      />
      {dialog && (
        <Dialog
          title={dialog === 'how-it-works' ? 'How it works' : availability[dialog].title}
          onClose={() => setDialog(null)}
        >
          {dialog === 'how-it-works' ? (
            <ol className="how-it-works">
              <li><strong>Get your crew together.</strong> Create a lobby or join with an invite code.</li>
              <li><strong>Find your options.</strong> Set a location, distance, cuisine, and budget.</li>
              <li><strong>Vote privately.</strong> Say yes, no, or veto. Votes stay hidden until everyone finishes.</li>
              <li><strong>Dinner, decided.</strong> Review the group’s favorites and choose a place to eat.</li>
            </ol>
          ) : (
            <p>{availability[dialog].message}</p>
          )}
        </Dialog>
      )}
    </>
  )
}

export default App
