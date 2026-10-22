import { useReducer } from 'react'
import type { ReactNode } from 'react'
import { reducePreferences } from './restaurantPreferences'
import type { PreferenceState } from './restaurantPreferences'
import { RestaurantPreferencesContext } from './useRestaurantPreferences'

/** App-shell lifetime, memory only. Refresh clears settings; routing does not. */
export function RestaurantPreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, dispatch] = useReducer(reducePreferences, new Map() as PreferenceState)
  return <RestaurantPreferencesContext value={{ preferences, dispatch }}>{children}</RestaurantPreferencesContext>
}
