import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
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
import { PartnerRestaurantPage } from '../pages/PartnerRestaurantPage'
import { PartnerAccessPage } from '../pages/PartnerAccessPage'
import { PartnerDemoPreviewProvider, RequirePartnerDemoPreview } from '../features/partner/PartnerDemoPreview'
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
      {
        element: <PartnerDemoPreviewProvider />,
        children: [
          { path: paths.partnerAccess, element: <PartnerAccessPage /> },
          {
            element: <RequirePartnerDemoPreview />,
            children: [{ path: paths.partnerRestaurant, element: <PartnerRestaurantPage /> }],
          },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
      { path: paths.admin, element: <AdminPage /> },
    ],
  },
]
