import heroFoodCollage from '../../assets/figma/hero-food-collage.png'
import { AppHeader } from '../layout/AppHeader'
import { Button } from '../ui/Button'
import './HomeScreen.css'

type HomeScreenProps = {
  onCreateLobby: () => void
  onJoinLobby: () => void
  onHowItWorks: () => void
}

export function HomeScreen({ onCreateLobby, onJoinLobby, onHowItWorks }: HomeScreenProps) {
  return (
    <div className="home-screen">
      <AppHeader onHowItWorks={onHowItWorks} onJoinLobby={onJoinLobby} />
      <main id="main-content" className="home-hero" tabIndex={-1}>
        <div className="home-hero__copy">
          <h1 className="home-hero__heading">
            <span>Your group is hungry.</span>
            <span>Your group chat is chaos.</span>
          </h1>
          <p className="home-hero__tagline">Dinner, Decided</p>
          <p className="home-hero__description">
            Fork Off turns preferences into a shortlist, a quick vote, and one
            clear place to eat - without exposing anyone’s vote.
          </p>
          <div className="home-hero__actions">
            <Button onClick={onCreateLobby}>Create a lobby</Button>
            <Button variant="secondary" onClick={onJoinLobby}>Join with a code</Button>
          </div>
        </div>
        <img
          className="home-hero__illustration"
          src={heroFoodCollage}
          width="2172"
          height="724"
          alt=""
          aria-hidden="true"
          fetchPriority="high"
        />
      </main>
    </div>
  )
}
