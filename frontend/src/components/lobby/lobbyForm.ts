export { cuisineOptions, priceOptions, distanceOptions, ratingOptions, validateLocation } from '../../features/preferences/restaurantPreferences'
export const diningOptions = ['Open at dining time', 'Serves alcohol', 'Mocktails'] as const

export function validateDateTime(value: string) {
  if (!value) return 'Choose a date and time for dinner.'
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Enter a valid date and time.'
  if (date.getTime() <= Date.now()) return 'Choose a date and time in the future.'
}

export function validateCode(value: string) {
  if (!value.trim()) return 'Enter your six-character invitation code.'
  if (!/^[a-z0-9]{6}$/i.test(value.trim())) return 'Use exactly 6 letters or numbers (for example, FORK42).'
}

export function validateDisplayName(value: string) {
  const name = value.trim()
  if (!name) return 'Enter the name your dinner crew will see.'
  if (name.length < 2) return 'Use at least 2 characters for your display name.'
  if (name.length > 40) return 'Keep your display name to 40 characters or fewer.'
}

/** Local calendar values avoid UTC shifts in a datetime-local input. */
export function initialDinnerTime() {
  const date = new Date()
  date.setHours(19, 30, 0, 0)
  if (date.getTime() <= Date.now()) date.setDate(date.getDate() + 1)
  const pad = (number: number) => String(number).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T19:30`
}

export function formatDinnerTime(value: string) {
  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return 'Choose a dinner time'
  const today = new Date()
  const day = date.toDateString() === today.toDateString()
    ? 'Tonight'
    : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
  return `${day} at ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`
}

export function toggleOption<T extends string>(selected: T[], option: T): T[] {
  return selected.includes(option) ? selected.filter(value => value !== option) : [...selected, option]
}
