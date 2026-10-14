export type LobbyMember = {
  name: string
  initials: string
  role: string
  ready: boolean
}

export function PlayerCard({ name, initials, role, ready }: LobbyMember) {
  return (
    <li className="lobby-member">
      <span className="lobby-avatar" aria-hidden="true">{initials}</span>
      <div className="lobby-member__identity">
        <p className="text-label-default">{name}</p>
        <p className="text-caption-default">{role}</p>
      </div>
      <span className="lobby-member__badge">{ready ? 'Ready' : 'Not ready'}</span>
    </li>
  )
}
