import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { ImportCollectionPage } from '../pages/ImportCollectionPage'
import { SavedPage } from '../pages/SavedPage'
import { GroupsPage } from '../pages/GroupsPage'
import { GroupDetailsPage } from '../pages/GroupDetailsPage'
import { HomePage } from '../pages/HomePage'
import { LoginPage } from '../pages/LoginPage'
import { CreateLobbyPage } from '../pages/CreateLobbyPage'
import { JoinLobbyPage } from '../pages/JoinLobbyPage'
import { LobbyPage } from '../pages/LobbyPage'
import { GroupChatPage } from '../pages/GroupChatPage'
import { DiscoveryPreviewPage } from '../pages/DiscoveryPreviewPage'
import { VotingPage } from '../pages/VotingPage'
import { RestaurantDetailsPage } from '../pages/RestaurantDetailsPage'
import { ResultsPage } from '../pages/ResultsPage'
import { LivePartnerRestaurantPage } from '../pages/LivePartnerRestaurantPage'
import { PartnerAccessPage } from '../pages/PartnerAccessPage'
import { AdminPage } from '../pages/AdminPage'
import {
  NotFoundPage,
} from '../pages/PlaceholderPages'
import { paths } from './paths'

/** Shared shell, consumer screens, partner access and development preview, and a fallback. */
export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: paths.home, element: <HomePage /> },
      { path: paths.saved, element: <SavedPage /> },
      { path: paths.groups, element: <GroupsPage /> },
      { path: paths.groupDetails, element: <GroupDetailsPage /> },
      { path: "/saved/import/:token", element: <ImportCollectionPage /> },
      { path: paths.login, element: <LoginPage /> },
      { path: paths.createLobby, element: <CreateLobbyPage /> },
      { path: paths.joinLobby, element: <JoinLobbyPage /> },
      { path: paths.lobby, element: <LobbyPage /> },
      { path: paths.discoveryPreview, element: <DiscoveryPreviewPage /> },
      { path: paths.voting, element: <VotingPage /> },
      { path: paths.restaurantDetails, element: <RestaurantDetailsPage /> },
      { path: `${paths.lobby}/restaurants`, element: <RestaurantDetailsPage /> },
      { path: paths.groupChat, element: <GroupChatPage /> },
      { path: paths.results, element: <ResultsPage /> },
      { path: paths.partnerAccess, element: <PartnerAccessPage /> },
      { path: paths.partnerRestaurant, element: <LivePartnerRestaurantPage /> },
      { path: '*', element: <NotFoundPage /> },
      { path: paths.admin, element: <AdminPage /> },
    ],
  },
]
