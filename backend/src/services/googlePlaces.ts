const PLACES_API_BASE = "https://places.googleapis.com/v1";
const SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.primaryType,places.types,places.location,places.googleMapsUri,places.photos,places.rating,places.userRatingCount,places.priceLevel,places.currentOpeningHours,places.regularOpeningHours,places.timeZone,places.servesBeer,places.servesWine,places.servesCocktails";
const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,primaryType,googleMapsUri,websiteUri,nationalPhoneNumber";

import 'dotenv/config';
import { createHash } from 'node:crypto';
import { Restaurant } from '../db_models/restaurant';

export interface GooglePhoto {
  name: string;
  authorAttributions?: {
    displayName: string;
    uri?: string;
  }[];
}



export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  photos?: GooglePhoto[];
  cachedPhoto?: boolean;
  photoAuthors?: GooglePhoto['authorAttributions'];
  types?: string[];
  rating?: number;
  userRatingCount?: number;
  priceLevel?: string;
  currentOpeningHours?: { openNow?: boolean; weekdayDescriptions?: string[] };
  regularOpeningHours?: { periods?: { open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }[]; weekdayDescriptions?: string[] };
  timeZone?: { id?: string };
  servesBeer?: boolean;
  servesWine?: boolean;
  servesCocktails?: boolean;
}

interface TextSearchResponse {
  places?: GooglePlace[];
}

export interface GoogleReview {
  name?: string;
  rating?: number;
  text?: { text: string; languageCode?: string };
  originalText?: { text: string; languageCode?: string };
  authorAttribution?: { displayName: string; uri?: string; photoUri?: string };
  publishTime?: string;
  relativePublishTimeDescription?: string;
  googleMapsUri?: string;
}

export async function getGooglePlaceReviews(placeId: string): Promise<GoogleReview[]> {
  const place = await requestPlaces<{ reviews?: GoogleReview[] }>(
    `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`, "reviews",
  );
  return place.reviews ?? [];
}

export class GooglePlacesError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "GooglePlacesError";
  }
}

async function requestPlaces<T>(url: string, fieldMask: string, body?: object): Promise<T> {
  const apiKey = process.env.GOOGLE_PLACES?.trim();
  if (!apiKey) {
    throw new GooglePlacesError(503, "GOOGLE_PLACES is not configured.");
  }

  const response = await fetch(url, {
    method: body ? "POST" : "GET",
    headers: {
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": fieldMask,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(10000),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error?: { message?: string } }).error?.message ?? "Request rejected")
        : "Request rejected";
    throw new GooglePlacesError(response.status, message);
  }

  return payload as T;
}

export async function searchRestaurants(query: string, limit: number, center?: { latitude: number; longitude: number }, radiusMeters?: number): Promise<GooglePlace[]> {
  const key = createHash('sha256').update(`v2\0${query.trim().toLowerCase()}\0${limit}\0${JSON.stringify(center)}\0${radiusMeters}`).digest('hex');
  const field = `searchCache.${key}`;
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const cached = await Restaurant.find({ [`${field}.fetchedAt`]: { $gt: cutoff }, cachedPlace: { $exists: true } }).lean();
  if (cached.length && cached.every(item => typeof (item.cachedPlace as GooglePlace).cachedPhoto === 'boolean')) {
    return cached.sort((a, b) => a.searchCache[key].rank - b.searchCache[key].rank).map(item => item.cachedPlace as GooglePlace);
  }
  const result = await requestPlaces<TextSearchResponse>(
    `${PLACES_API_BASE}/places:searchText`,
    SEARCH_FIELD_MASK,
    {
      textQuery: query,
      includedType: "restaurant",
      strictTypeFiltering: true,
      maxResultCount: limit,
      ...(center && radiusMeters ? { locationBias: { circle: { center, radius: Math.min(radiusMeters, 50000) } } } : {}),
      languageCode: "en",
      regionCode: "US",
    },
  );

  const places = (result.places ?? []).filter((place) => Boolean(place.id));
  if (places.length) {
    const fetchedAt = new Date();
    const photos = await Promise.all(places.map(async place => {
      const uri = await getPhotoUrl(place.photos?.[0]);
      if (!uri) return null;
      try {
        const response = await fetch(uri, { signal: AbortSignal.timeout(10000) });
        const type = response.headers.get('content-type')?.split(';')[0] ?? '';
        if (!response.ok || !['image/jpeg', 'image/png', 'image/webp'].includes(type)) return null;
        const bytes = Buffer.from(await response.arrayBuffer());
        return bytes.length && bytes.length <= 2 * 1024 * 1024 ? { bytes, type } : null;
      } catch { return null; }
    }));
    await Restaurant.bulkWrite(places.map((place, rank) => {
      const { photos: _photos, ...cachedPlace } = place;
      const photo = photos[rank];
      const storedPlace = { ...cachedPlace, cachedPhoto: Boolean(photo), photoAuthors: photo ? place.photos?.[0]?.authorAttributions ?? [] : [] };
      return { updateOne: { filter: { placeId: place.id }, update: { $set: { cachedPlace: storedPlace, cachedAt: fetchedAt, [field]: { fetchedAt, rank }, ...(photo ? { cachedPhoto: photo.bytes, cachedPhotoType: photo.type } : {}) }, ...(!photo ? { $unset: { cachedPhoto: 1, cachedPhotoType: 1 } } : {}), $setOnInsert: { placeId: place.id } }, upsert: true } };
    }), { ordered: false });
    return places.map((place, index) => ({ ...place, cachedPhoto: Boolean(photos[index]), photoAuthors: photos[index] ? place.photos?.[0]?.authorAttributions ?? [] : [] }));
  }
  return places;
}

export async function resolveSearchLocation(location: string): Promise<{ latitude: number; longitude: number }> {
  const result = await requestPlaces<TextSearchResponse>(`${PLACES_API_BASE}/places:searchText`, 'places.location', {
    textQuery: location, maxResultCount: 1, languageCode: 'en', regionCode: 'US',
  });
  const center = result.places?.[0]?.location;
  if (!center) throw new GooglePlacesError(400, 'Could not locate the selected address or city.');
  return center;
}

export async function clearExpiredRestaurantCache() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  await Restaurant.updateMany({ cachedAt: { $lte: cutoff } }, { $unset: { cachedPlace: 1, cachedAt: 1, searchCache: 1, cachedPhoto: 1, cachedPhotoType: 1 } });
}

export async function getGooglePlace(placeId: string): Promise<GooglePlace> {
  const url = `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`;
  return requestPlaces<GooglePlace>(url, DETAILS_FIELD_MASK);
}

export async function getPhotoUrl(
  photo: GooglePhoto | undefined,

): Promise<string | null> {
  if (!photo) return null;

  const apiKey = process.env.GOOGLE_PLACES?.trim();
  if (!apiKey) return null;

  try {
    const url = new URL(
      `${PLACES_API_BASE}/${photo.name}/media`,
    );

    url.searchParams.set("maxWidthPx", "600");
    url.searchParams.set("skipHttpRedirect", "true");

    const response = await fetch(url, {
      headers: { "X-Goog-Api-Key": apiKey },
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return null;

    const result = await response.json() as {
      photoUri?: string;
    };
    return result.photoUri ?? null;
  }
  catch {
    return null;
  }
}

