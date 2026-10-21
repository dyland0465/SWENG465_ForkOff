import { useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { Button } from './Button'
import './Dialog.css'

type DialogProps = {
  title: string
  children: ReactNode
  onClose: () => void
}

/** Native modal semantics provide Escape, focus trapping, and focus restoration. */
export function Dialog({ title, children, onClose }: DialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  return (
    <dialog ref={dialogRef} className="ui-dialog" aria-labelledby={titleId} onClose={onClose}>
      <h2 id={titleId} className="text-heading-h2">{title}</h2>
      <div className="ui-dialog__body text-body-large">{children}</div>
      <Button onClick={() => dialogRef.current?.close()}>Back to home</Button>
    </dialog>
  )
}
