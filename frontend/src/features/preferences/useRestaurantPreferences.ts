import { createContext, useContext } from 'react'
import type { Dispatch } from 'react'
import { getPreferences } from './restaurantPreferences'
import type { PreferenceAction, PreferenceState, RestaurantPreferences } from './restaurantPreferences'

export const RestaurantPreferencesContext = createContext<{
  preferences: PreferenceState
  dispatch: Dispatch<PreferenceAction>
} | null>(null)

export function useRestaurantPreferences(lobbyId: string, roundId: string | null = null) {
  const context = useContext(RestaurantPreferencesContext)
  if (!context) throw new Error('Restaurant preferences require RestaurantPreferencesProvider.')
  return {
    filters: getPreferences(context.preferences, { lobbyId, roundId }),
    setFilters: (preferences: RestaurantPreferences) => context.dispatch({ type: 'apply', lobbyId, roundId, preferences }),
    resetFilters: () => context.dispatch({ type: 'reset', lobbyId, roundId }),
  }
}
