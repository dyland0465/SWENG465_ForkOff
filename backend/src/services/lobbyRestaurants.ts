import { GooglePlacesError, getGooglePlace, resolveSearchLocation, searchRestaurantPage } from './googlePlaces'
import type { GooglePlace } from './googlePlaces'
import type { LobbyDocument } from './lobbyState'
import { Restaurant } from '../db_models/restaurant'
import { chooseRestaurants } from './restaurantSelection'

type Filters = LobbyDocument['filters']
const priceValues: Record<string, string> = { '$': 'PRICE_LEVEL_INEXPENSIVE', '$$': 'PRICE_LEVEL_MODERATE', '$$$': 'PRICE_LEVEL_EXPENSIVE' }
const cuisineTypes: Record<string, string[]> = {
  italian: ['italian_restaurant', 'pizza_restaurant'], ramen: ['ramen_restaurant'],
  mexican: ['mexican_restaurant'], american: ['american_restaurant'],
  asian: ['asian_restaurant', 'asian_fusion_restaurant', 'chinese_restaurant', 'japanese_restaurant', 'korean_restaurant', 'thai_restaurant', 'vietnamese_restaurant', 'indian_restaurant', 'ramen_restaurant', 'sushi_restaurant'],
  'fast food': ['fast_food_restaurant'],
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
export async function findLobbyRestaurants(filters: Filters, excludeIds: string[] = []) {
  const location = filters.location?.trim()
  if (!location) throw new GooglePlacesError(400, 'Set a lobby location before searching.')
  const center = await resolveSearchLocation(location)
  const radius = (filters.maxDistance ?? 10) * 1609.344
  const categories = (filters.categories ?? []).map(value => value.trim().toLowerCase()).filter(Boolean)
  const needs = (filters.diningNeeds ?? []).map(value => value.trim().toLowerCase())
  const dinner = filters.dinnerAt ? new Date(filters.dinnerAt) : null
  const warnings: string[] = []
  if (needs.includes('mocktails')) warnings.push('Mocktail availability could not be verified.')
  const unknown = needs.filter(n => !['mocktails', 'serves alcohol', 'open at dining time'].includes(n))
  if (unknown.length) warnings.push(`Could not verify dining needs: ${unknown.join(', ')}.`)
  if (needs.includes('open at dining time')) warnings.push('Dining-time availability uses regular hours; special hours may differ.')
  const restaurants: { id: string; name: string; address: string | null; category: string | null; googleMapsUri: string | null; photoUrl: string | null; photoAuthors: NonNullable<GooglePlace['photoAuthors']>; rating: number | null; ratingCount: number | null; priceLevel: string | null; distanceMiles: number; hours: string[]; timeZone?: string | null }[] = []
  const seen = new Set<string>()
  const excluded = new Set(excludeIds)
  const alternatives: typeof restaurants = []
  let pageToken: string | undefined
  let refresh = false
  for (let page = 0; page < 3; page++) {
    let result: Awaited<ReturnType<typeof searchRestaurantPage>>
    try {
      result = await searchRestaurantPage('restaurants', 20, center, radius, pageToken, refresh)
    } catch (error) {
      // Cached continuation tokens can expire; get a fresh sequence once.
      if (!refresh && pageToken && error instanceof GooglePlacesError && error.statusCode === 400) {
        refresh = true
        pageToken = undefined
        restaurants.length = 0
        alternatives.length = 0
        seen.clear()
        page = -1
        continue
      }
      throw error
    }
    const matches = result.places.flatMap(place => {
    if (seen.has(place.id)) return []
    seen.add(place.id)
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
      distanceMiles: Math.round(distance * 10) / 10, hours: place.regularOpeningHours?.weekdayDescriptions ?? [], timeZone: place.timeZone?.id ?? null }]
    })
    for (const match of matches) {
      if (excluded.has(match.id)) alternatives.push(match)
      else restaurants.push(match)
    }
    if (!result.nextPageToken) break
    pageToken = result.nextPageToken
  }
  return { restaurants: chooseRestaurants(restaurants, alternatives), warnings }
}

// Collection lobbies use the saved IDs as their voting pool, independent of discovery filters.
export async function findCollectionRestaurants(source: { placeIds: string[] }, excludeIds: string[] = []) {
  const excluded = new Set(excludeIds)
  const unique = [...new Set(source.placeIds)]
  const selected = chooseRestaurants(unique.filter(id => !excluded.has(id)).map(id => ({ id })), unique.filter(id => excluded.has(id)).map(id => ({ id })))
  const cached = await Restaurant.find({ placeId: { $in: selected.map(item => item.id) }, cachedAt: { $gt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }).select({ placeId: 1, cachedPlace: 1 }).lean()
  const byId = new Map(cached.map(item => [item.placeId, item.cachedPlace as GooglePlace]))
  const restaurants = await Promise.all(selected.map(async ({ id }) => {
    const place = byId.get(id) ?? await getGooglePlace(id)
    return { id, name: place.displayName?.text ?? 'Unnamed restaurant', address: place.formattedAddress ?? null,
      category: place.primaryType ?? null, googleMapsUri: place.googleMapsUri ?? null,
      photoUrl: place.cachedPhoto ? `/api/restaurant-photos/${encodeURIComponent(id)}` : null,
      photoAuthors: place.photoAuthors ?? [], rating: place.rating ?? null, ratingCount: place.userRatingCount ?? null,
      priceLevel: place.priceLevel ?? null, distanceMiles: null, hours: place.regularOpeningHours?.weekdayDescriptions ?? [], timeZone: place.timeZone?.id ?? null }
  }))
  return { restaurants, warnings: [] as string[] }
}
