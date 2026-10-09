import type { ComponentProps } from 'react'
import { Link } from 'react-router'
import type { LinkProps } from 'react-router'
import './TextAction.css'

type ActionAppearance = {
  tone?: 'default' | 'danger' | 'on-dark' | 'nav'
  current?: boolean
}

export type TextActionProps = ActionAppearance & (
  | (LinkProps & { to: LinkProps['to']; href?: never })
  | (ComponentProps<'a'> & { href: string; to?: never })
  | (ComponentProps<'button'> & { href?: never; to?: never })
)

export function TextAction({
  tone = 'default',
  current = false,
  className = '',
  ...props
}: TextActionProps) {
  const classes = `ui-text-action ui-text-action--${tone} ${current ? 'is-current' : ''} ${className}`.trim()

  if (props.to !== undefined) {
    return <Link {...props} className={classes} aria-current={current ? 'page' : undefined} />
  }

  if (props.href !== undefined) {
    return <a {...props} className={classes} aria-current={current ? 'page' : undefined} />
  }

  return <button type="button" {...props} className={classes} aria-current={current ? 'page' : undefined} />
}
