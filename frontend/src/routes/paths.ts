/** Dynamic paths require real IDs supplied by the caller; no IDs are invented here. */
export const paths = {
  home: '/',
  saved: '/saved',
  groups: '/groups',
  groupDetails: '/groups/:groupId',
    login: '/login',
  createLobby: '/lobbies/create',
  joinLobby: '/lobbies/join',
  lobby: '/lobbies/:lobbyId',
  discoveryPreview: '/lobbies/:lobbyId/discovery',
  voting: '/lobbies/:lobbyId/voting',
  restaurantDetails: '/lobbies/:lobbyId/restaurants/:restaurantId',
  groupChat: '/lobbies/:lobbyId/chat',
  results: '/lobbies/:lobbyId/results',
  partnerAccess: '/partners',
  admin: '/admin',
  partnerRestaurant: '/partners/:restaurantId',
} as const
