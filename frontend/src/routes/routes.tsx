import type { RouteObject } from 'react-router'
import { AppLayout } from '../components/layout/AppLayout'
import { HomePage } from '../pages/HomePage'
import {
  CreateLobbyPage,
  JoinLobbyPage,
  LobbyPage,
  DiscoveryPreviewPage,
  VotingPage,
  RestaurantDetailsPage,
  GroupChatPage,
  ResultsPage,
  PartnerRestaurantPage,
  NotFoundPage,
} from '../pages/PlaceholderPages'
import { paths } from './paths'

/** One shared shell and ten screen destinations, plus an unmatched-URL fallback. */
export const appRoutes: RouteObject[] = [
  {
    element: <AppLayout />,
    children: [
      { path: paths.home, element: <HomePage /> },
      { path: paths.createLobby, element: <CreateLobbyPage /> },
      { path: paths.joinLobby, element: <JoinLobbyPage /> },
      { path: paths.lobby, element: <LobbyPage /> },
      { path: paths.discoveryPreview, element: <DiscoveryPreviewPage /> },
      { path: paths.voting, element: <VotingPage /> },
      { path: paths.restaurantDetails, element: <RestaurantDetailsPage /> },
      { path: paths.groupChat, element: <GroupChatPage /> },
      { path: paths.results, element: <ResultsPage /> },
      { path: paths.partnerRestaurant, element: <PartnerRestaurantPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]
