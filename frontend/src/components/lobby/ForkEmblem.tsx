import forkEmblem from '../../assets/figma/fork-emblem.png'

/** Preserve the 84 × 121 image crop inside Figma's 104px circular container. */
export function ForkEmblem() {
  return <div className="lobby-fork-emblem" aria-hidden="true"><img src={forkEmblem} width="84" height="121" alt="" /></div>
}
