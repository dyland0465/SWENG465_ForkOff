import { generatePath, useParams } from 'react-router'
import { TextAction } from '../components/ui/TextAction'
import { paths } from '../routes/paths'

type PlaceholderPageProps = {
  title: string
  backTo?: string
  backLabel?: string
}

function PlaceholderPage({
  title,
  backTo = paths.home,
  backLabel = 'Back to home',
}: PlaceholderPageProps) {
  return (
    <main id="main-content" className="route-placeholder" tabIndex={-1}>
      <h1 className="text-heading-h1">{title}</h1>
      <p className="text-body-large">This screen is coming soon.</p>
      <TextAction to={backTo}>{backLabel}</TextAction>
    </main>
  )
}

function LobbyPlaceholder({ title }: { title: string }) {
  const { lobbyId } = useParams<'lobbyId'>()

  return (
    <PlaceholderPage
      title={title}
      backTo={lobbyId ? generatePath(paths.lobby, { lobbyId }) : paths.home}
      backLabel={lobbyId ? 'Back to lobby' : 'Back to home'}
    />
  )
}

export function CreateLobbyPage() {
  return <PlaceholderPage title="Create a lobby" />
}

export function JoinLobbyPage() {
  return <PlaceholderPage title="Join with a code" />
}

export function LobbyPage() {
  return <PlaceholderPage title="Lobby" />
}

export function DiscoveryPreviewPage() {
  return <LobbyPlaceholder title="Discovery preview" />
}

export function VotingPage() {
  return <LobbyPlaceholder title="Voting" />
}

export function RestaurantDetailsPage() {
  return <LobbyPlaceholder title="Restaurant details" />
}

export function GroupChatPage() {
  return <LobbyPlaceholder title="Group chat" />
}

export function ResultsPage() {
  return <LobbyPlaceholder title="Results and final choice" />
}

export function PartnerRestaurantPage() {
  return <PlaceholderPage title="Partner restaurant" />
}

export function NotFoundPage() {
  return (
    <main id="main-content" className="route-placeholder" tabIndex={-1}>
      <h1 className="text-heading-h1">Page not found</h1>
      <p className="text-body-large">We couldn’t find that page.</p>
      <TextAction to={paths.home}>Back to home</TextAction>
    </main>
  )
}
