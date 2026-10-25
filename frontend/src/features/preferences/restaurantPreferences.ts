export const cuisineOptions = ['Italian', 'Ramen', 'Mexican', 'American', 'Vegetarian'] as const
export const priceOptions = ['$', '$$', '$$$'] as const
export const distanceOptions = ['1', '3', '5', '8', '10', '15', '25'] as const
export const ratingOptions = ['any', '3.0', '3.5', '4.0', '4.5'] as const
export const diningNeedOptions = ['Serves alcohol', 'Mocktails'] as const
export const availabilityOptions = ['any', 'openNow', 'atDiningTime'] as const

/** Calendar date and wall-clock time, without an invented timezone or date. Empty means any. */
export type RestaurantPreferences = Readonly<{
  location: string
  date: string
  time: string
  distance: 'any' | typeof distanceOptions[number]
  rating: typeof ratingOptions[number]
  cuisines: readonly typeof cuisineOptions[number][]
  prices: readonly typeof priceOptions[number][]
  diningNeeds: readonly typeof diningNeedOptions[number][]
  availability: typeof availabilityOptions[number]
}>

/** Reset restores these same demo defaults on every screen, including location/date/time. */
export function defaultRestaurantPreferences(): RestaurantPreferences {
  return {
    location: 'Erie, PA', date: '', time: '19:30', distance: '5', rating: '4.0',
    cuisines: ['Italian', 'Ramen'], prices: ['$$'], diningNeeds: ['Mocktails'], availability: 'atDiningTime',
  }
}

export function validateLocation(value: string) {
  if (!value.trim()) return 'Enter a city, ZIP code, or address.'
  if (value.trim().length < 2) return 'Enter at least 2 characters for the location.'
  if (value.trim().length > 120) return 'Keep the location to 120 characters or fewer.'
}

export function validatePreferenceDate(value: string) {
  if (!value) return
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return 'Choose a valid dining date.'
  const date = new Date(`${value}T12:00:00`)
  if (!Number.isFinite(date.getTime()) || date.getFullYear() !== Number(value.slice(0, 4))
    || date.getMonth() + 1 !== Number(value.slice(5, 7)) || date.getDate() !== Number(value.slice(8))) {
    return 'Choose a valid dining date.'
  }
}

export const preferenceValidators = {
  location: validateLocation,
  date: validatePreferenceDate,
  time: (value: string) => !value || /^([01]\d|2[0-3]):[0-5]\d$/.test(value) ? undefined : 'Choose a valid dining time.',
  distance: (value: string) => value === 'any' || distanceOptions.some(option => option === value) ? undefined : 'Choose a distance.',
  rating: (value: string) => ratingOptions.some(option => option === value) ? undefined : 'Choose a minimum rating.',
  availability: (value: string) => availabilityOptions.some(option => option === value) ? undefined : 'Choose an availability preference.',
}

export type PreferenceFields = Record<keyof typeof preferenceValidators, string>

/** Validated form boundary, also reusable by a future backend hydration adapter. No coercion/loss. */
export function preferencesFromFields(fields: PreferenceFields, selections: Pick<RestaurantPreferences, 'cuisines' | 'prices' | 'diningNeeds'>): RestaurantPreferences {
  for (const key of Object.keys(preferenceValidators) as (keyof PreferenceFields)[]) {
    const error = preferenceValidators[key](fields[key])
    if (error) throw new Error(error)
  }
  if (selections.cuisines.some(value => !cuisineOptions.includes(value))
    || selections.prices.some(value => !priceOptions.includes(value))
    || selections.diningNeeds.some(value => !diningNeedOptions.includes(value))) throw new Error('Unknown restaurant preference.')
  return {
    ...fields, location: fields.location.trim(),
    distance: fields.distance as RestaurantPreferences['distance'],
    rating: fields.rating as RestaurantPreferences['rating'],
    availability: fields.availability as RestaurantPreferences['availability'],
    cuisines: [...selections.cuisines], prices: [...selections.prices].sort((a, b) => a.length - b.length), diningNeeds: [...selections.diningNeeds],
  }
}

export function formatPreferenceTime(time: string) {
  if (!time) return 'Any time'
  const [hour, minute] = time.split(':').map(Number)
  return `${hour % 12 || 12}:${String(minute).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`
}

export function formatPreferenceDate(date: string) {
  return date ? new Date(`${date}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : 'Any date'
}

export function formatPreferenceSchedule(filters: RestaurantPreferences) {
  return `${formatPreferenceDate(filters.date)} · ${formatPreferenceTime(filters.time)}`
}

export function formatPreferenceDistance(distance: RestaurantPreferences['distance']) {
  return distance === 'any' ? 'Any distance' : `Within ${distance} ${distance === '1' ? 'mile' : 'miles'}`
}

export function formatPreferenceAvailability(availability: RestaurantPreferences['availability']) {
  return { any: 'Any availability', openNow: 'Open now', atDiningTime: 'Open at dining time' }[availability]
}

export function preferenceSummary(filters: RestaurantPreferences) {
  return [
    filters.location, formatPreferenceSchedule(filters), formatPreferenceDistance(filters.distance),
    filters.cuisines.join(' + ') || 'Any cuisine', filters.prices.join(' / ') || 'Any price',
    filters.rating === 'any' ? 'Any rating' : `${filters.rating}+`,
    formatPreferenceAvailability(filters.availability), filters.diningNeeds.join(' · ') || 'No dining requirements',
  ].join(' · ')
}

export function hasDefaultPreferences(filters: RestaurantPreferences) {
  const defaults = defaultRestaurantPreferences()
  return (Object.keys(defaults) as (keyof RestaurantPreferences)[]).every(key => {
    const value = filters[key], initial = defaults[key]
    return Array.isArray(value) && Array.isArray(initial)
      ? value.length === initial.length && value.every(option => initial.includes(option))
      : value === initial
  })
}

/** Null identifies editable local settings; future server round IDs get independent snapshots. */
export type PreferenceScope = { lobbyId: string; roundId?: string | null }
export type PreferenceState = ReadonlyMap<string, ReadonlyMap<string | null, RestaurantPreferences>>
export type PreferenceAction = PreferenceScope & (
  | { type: 'apply'; preferences: RestaurantPreferences }
  | { type: 'reset' }
)

export function getPreferences(state: PreferenceState, { lobbyId, roundId = null }: PreferenceScope) {
  return state.get(lobbyId)?.get(roundId) ?? defaultRestaurantPreferences()
}

export function reducePreferences(state: PreferenceState, action: PreferenceAction): PreferenceState {
  const next = action.type === 'reset' ? defaultRestaurantPreferences() : preferencesFromFields(action.preferences, action.preferences)
  const rounds = new Map(state.get(action.lobbyId))
  rounds.set(action.roundId ?? null, next)
  return new Map(state).set(action.lobbyId, rounds)
}
