import { useLayoutEffect, useRef } from 'react'
import { ScrollRestoration, useLocation } from 'react-router'

/** Keep focus independent of the history entry's restored scroll position. */
export function RouteNavigation() {
  const { pathname } = useLocation()
  const previousPath = useRef(pathname)

  useLayoutEffect(() => {
    if (previousPath.current !== pathname) {
      document.getElementById('main-content')?.focus({ preventScroll: true })
      previousPath.current = pathname
    }
  }, [pathname])

  // The default location.key keeps separate positions for repeated visits to a
  // screen. Results selections already opt out of resetting scroll on PUSH.
  // Query/hash changes leave focus alone; initial loads keep native focus.
  return <ScrollRestoration />
}
