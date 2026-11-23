import { useState } from 'react'
import type { ReactNode } from 'react'
import { LiveLobbyContext } from './liveLobby'
import type { ChatMessage, LiveLobby } from './liveLobby'
import harbor from '../../assets/figma/discovery/harbor-and-hearth.png'
import copper from '../../assets/figma/discovery/copper-bowl-kitchen.png'
import ramen from '../../assets/figma/discovery/north-pier-ramen.png'

export const layoutTestLobbyId = 'layout-test'
export const layoutTestRestaurants = [
  { id: 'harbor', name: 'Harbor & Hearth', photoUrl: harbor },
  { id: 'copper', name: 'Copper Bowl Kitchen', photoUrl: copper },
  { id: 'ramen', name: 'North Pier Ramen', photoUrl: ramen },
]

const initialLobby: LiveLobby = {
  id: layoutTestLobbyId,
  name: 'Dinner in Erie, PA',
  lobbyCode: 'DEMO25',
  status: 'waiting',
  revision: 0,
  roundId: null,
  hostMemberId: 'host',
  selfMemberId: 'host',
  isHost: true,
  members: [{ memberId: 'host', type: 'guest', displayName: 'Preview host', joinOrder: 0, online: true }],
  filters: { location: 'Erie, PA', maxDistance: 5, minimumRating: 4 },
}

export function LayoutTestLobby({ children }: { children: ReactNode }) {
  const [lobby, setLobby] = useState(initialLobby)
  const [messages, setMessages] = useState<ChatMessage[]>([])

  return <LiveLobbyContext.Provider value={{
    lobby,
    messages,
    error: '',
    notice: '',
    connection: 'Sample data',
    nextCursor: null,
    refresh: () => {},
    loadOlder: async () => {},
    sendMessage: async (text, requestId) => {
      setMessages(current => [...current, { id: requestId, requestId, text, memberId: 'host', senderName: 'Preview host', createdAt: new Date().toISOString() }])
    },
    mutate: async (path, method, body) => {
      if (path === '/ready') {
        setLobby(current => ({ ...current, members: current.members.map(member => ({ ...member, ready: Boolean((body as { ready?: boolean }).ready) })) }))
      } else if (path === '' && method === 'PATCH') {
        setLobby(current => ({ ...current, ...(body as Pick<LiveLobby, 'name' | 'status' | 'filters'>) }))
      }
    },
  }}>{children}</LiveLobbyContext.Provider>
}
