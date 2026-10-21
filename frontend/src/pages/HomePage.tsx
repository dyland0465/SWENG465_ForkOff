import { useNavigate } from 'react-router'
import { HomeScreen } from '../components/home/HomeScreen'
import { paths } from '../routes/paths'

export function HomePage() {
  const navigate = useNavigate()

  return (
    <HomeScreen
      onCreateLobby={() => navigate(paths.createLobby)}
      onJoinLobby={() => navigate(paths.joinLobby)}
    />
  )
}
