import type { ComponentProps } from 'react'
import './TextAction.css'

type ActionAppearance = {
  tone?: 'default' | 'danger' | 'on-dark' | 'nav'
  current?: boolean
}

export type TextActionProps = ActionAppearance & (
  | (ComponentProps<'a'> & { href: string })
  | (ComponentProps<'button'> & { href?: never })
)

export function TextAction({
  tone = 'default',
  current = false,
  className = '',
  ...props
}: TextActionProps) {
  const classes = `ui-text-action ui-text-action--${tone} ${current ? 'is-current' : ''} ${className}`.trim()

  if (props.href !== undefined) {
    return <a {...props} className={classes} aria-current={current ? 'page' : undefined} />
  }

  return <button type="button" {...props} className={classes} aria-current={current ? 'page' : undefined} />
}
