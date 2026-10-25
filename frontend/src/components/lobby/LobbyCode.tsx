import { useEffect, useRef, useState } from 'react'
import { TextAction } from '../ui/TextAction'

export function LobbyCode({ code }: { code: string }) {
  const [copyState, setCopyState] = useState<'idle' | 'copying' | 'copied' | 'error'>('idle')
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => () => clearTimeout(resetTimer.current), [])

  async function copyCode() {
    clearTimeout(resetTimer.current)
    setCopyState('copying')
    try {
      await navigator.clipboard.writeText(code)
      setCopyState('copied')
      resetTimer.current = setTimeout(() => setCopyState('idle'), 3000)
    } catch {
      setCopyState('error')
    }
  }

  return (
    <section className="lobby-code" aria-labelledby="lobby-code-heading">
      <div>
        <h2 id="lobby-code-heading">INVITE CODE</h2>
        <p className="lobby-code__value">{code}</p>
      </div>
      <TextAction tone="on-dark" onClick={copyCode} disabled={copyState === 'copying'}>
        {copyState === 'copied' ? 'Copied!' : copyState === 'copying' ? 'Copying…' : 'Copy Code'}
      </TextAction>
      <p className={`lobby-code__feedback${copyState === 'error' ? ' is-error' : ''}`} role="status">
        {copyState === 'copied' ? 'Invite code copied.' : copyState === 'error' ? `Clipboard unavailable. Select and copy ${code} manually.` : ''}
      </p>
    </section>
  )
}
