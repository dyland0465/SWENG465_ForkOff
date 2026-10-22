const PLACES_API_BASE = "https://places.googleapis.com/v1";
const SEARCH_FIELD_MASK =
  "places.id,places.displayName,places.formattedAddress,places.primaryType,places.googleMapsUri";
const DETAILS_FIELD_MASK =
  "id,displayName,formattedAddress,location,primaryType,googleMapsUri,websiteUri,nationalPhoneNumber";
import 'dotenv/config';

export interface GooglePlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
}

interface TextSearchResponse {
  places?: GooglePlace[];
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

export async function searchRestaurants(query: string, limit: number): Promise<GooglePlace[]> {
  const result = await requestPlaces<TextSearchResponse>(
    `${PLACES_API_BASE}/places:searchText`,
    SEARCH_FIELD_MASK,
    {
      textQuery: query,
      includedType: "restaurant",
      strictTypeFiltering: true,
      maxResultCount: limit,
      languageCode: "en",
      regionCode: "US",
    },
  );

  return (result.places ?? []).filter((place) => Boolean(place.id));
}

export async function getGooglePlace(placeId: string): Promise<GooglePlace> {
  const url = `${PLACES_API_BASE}/places/${encodeURIComponent(placeId)}`;
  return requestPlaces<GooglePlace>(url, DETAILS_FIELD_MASK);
}
