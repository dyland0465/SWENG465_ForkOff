import { PlayerCard } from './PlayerCard'
import type { LobbyMember } from './PlayerCard'

export function PlayerList({ members }: { members: readonly LobbyMember[] }) {
  return (
    <section className="lobby-members" aria-labelledby="lobby-members-heading">
      <h2 id="lobby-members-heading" className="lobby-section-heading">Members · {members.length}</h2>
      <ul className="lobby-members__list">
        {members.map(member => <PlayerCard key={member.name} {...member} />)}
      </ul>
    </section>
  )
}
