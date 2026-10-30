import { GooglePlacesError, resolveSearchLocation, searchRestaurants } from './googlePlaces'
import type { GooglePlace } from './googlePlaces'
import type { LobbyDocument } from './lobbyState'

type Filters = LobbyDocument['filters']
const priceValues: Record<string, string> = { '$': 'PRICE_LEVEL_INEXPENSIVE', '$$': 'PRICE_LEVEL_MODERATE', '$$$': 'PRICE_LEVEL_EXPENSIVE' }
const cuisineTypes: Record<string, string[]> = {
  italian: ['italian_restaurant', 'pizza_restaurant'], ramen: ['ramen_restaurant'],
  mexican: ['mexican_restaurant'], american: ['american_restaurant'],
  vegetarian: ['vegetarian_restaurant', 'vegan_restaurant'],
}
function distanceMiles(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const rad = Math.PI / 180
  const dlat = (b.latitude - a.latitude) * rad, dlon = (b.longitude - a.longitude) * rad
  const x = Math.sin(dlat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dlon / 2) ** 2
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x))
}
function openAt(place: GooglePlace, date: Date): boolean | null {
  const periods = place.regularOpeningHours?.periods
  const zone = place.timeZone?.id
  if (!periods || !zone || !Number.isFinite(date.getTime())) return null
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(date)
    const get = (type: string) => parts.find(p => p.type === type)?.value
    const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday') ?? '')
    const time = day * 1440 + Number(get('hour')) * 60 + Number(get('minute'))
    if (day < 0 || !Number.isFinite(time)) return null
    return periods.some(period => {
      if (!period.close) return period.open.day === 0 && period.open.hour === 0 && period.open.minute === 0
      const start = period.open.day * 1440 + period.open.hour * 60 + period.open.minute
      let end = period.close.day * 1440 + period.close.hour * 60 + period.close.minute
      if (end <= start) end += 10080
      return (time >= start && time < end) || (time + 10080 >= start && time + 10080 < end)
    })
  } catch { return null }
}
export async function findLobbyRestaurants(filters: Filters) {
  const location = filters.location?.trim()
  if (!location) throw new GooglePlacesError(400, 'Set a lobby location before searching.')
  const center = await resolveSearchLocation(location)
  const radius = (filters.maxDistance ?? 10) * 1609.344
  const places = await searchRestaurants('restaurants', 20, center, radius)
  const categories = (filters.categories ?? []).map(value => value.trim().toLowerCase()).filter(Boolean)
  const needs = (filters.diningNeeds ?? []).map(value => value.trim().toLowerCase())
  const dinner = filters.dinnerAt ? new Date(filters.dinnerAt) : null
  const warnings: string[] = []
  if (needs.includes('mocktails')) warnings.push('Mocktail availability could not be verified.')
  const unknown = needs.filter(n => !['mocktails', 'serves alcohol', 'open at dining time'].includes(n))
  if (unknown.length) warnings.push(`Could not verify dining needs: ${unknown.join(', ')}.`)
  if (needs.includes('open at dining time')) warnings.push('Dining-time availability uses regular hours; special hours may differ.')
  const restaurants = places.flatMap(place => {
    if (!place.location) return []
    const distance = distanceMiles(center, place.location)
    if (distance > (filters.maxDistance ?? 10)) return []
    if ((filters.minimumRating ?? 0) > 0 && (place.rating === undefined || place.rating < filters.minimumRating!)) return []
    if (filters.priceLevels?.length && (!place.priceLevel || !filters.priceLevels.some(p => priceValues[p] === place.priceLevel))) return []
    const types = [place.primaryType ?? '', ...(place.types ?? [])]
    if (categories.length && !categories.some(category => (cuisineTypes[category] ?? [`${category.replace(/\s+/g, '_')}_restaurant`]).some(type => types.includes(type)))) return []
    if (needs.includes('serves alcohol') && ![place.servesBeer, place.servesWine, place.servesCocktails].some(Boolean)) return []
    if (filters.openNow && openAt(place, new Date()) !== true) return []
    if (needs.includes('open at dining time') && (!dinner || openAt(place, dinner) !== true)) return []
    return [{ id: place.id, name: place.displayName?.text ?? 'Unnamed restaurant', address: place.formattedAddress ?? null,
      category: place.primaryType ?? null, googleMapsUri: place.googleMapsUri ?? null,
      photoUrl: place.cachedPhoto ? `/api/restaurant-photos/${encodeURIComponent(place.id)}` : null,
      photoAuthors: place.cachedPhoto ? place.photoAuthors ?? [] : [], rating: place.rating ?? null,
      ratingCount: place.userRatingCount ?? null, priceLevel: place.priceLevel ?? null,
      distanceMiles: Math.round(distance * 10) / 10, hours: place.regularOpeningHours?.weekdayDescriptions ?? [] }]
  }).slice(0, 10)
  return { restaurants, warnings }
}
