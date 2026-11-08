import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import './Dialog.css'

type DialogProps = {
  title: string
  children: ReactNode
  onClose: () => void
  closeLabel?: string
  busy?: boolean
  focusClose?: boolean
}

/** Native modal semantics provide Escape, focus trapping, and focus restoration. */
export function Dialog({ title, children, onClose, closeLabel = 'Back', busy = false, focusClose = false }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
    if (focusClose) closeRef.current?.focus()
  }, [focusClose])

  return (
    <dialog ref={dialogRef} className="ui-dialog" aria-labelledby={titleId} onClose={onClose} onCancel={event => { if (busy) event.preventDefault() }}>
      <h2 id={titleId} className="text-heading-h2">{title}</h2>
      <div className="ui-dialog__body text-body-large">{children}</div>
      <Button ref={closeRef} disabled={busy} variant={closeLabel === 'Cancel' ? 'secondary' : 'primary'} onClick={() => dialogRef.current?.close()}>{closeLabel}</Button>
    </dialog>
  )
}
