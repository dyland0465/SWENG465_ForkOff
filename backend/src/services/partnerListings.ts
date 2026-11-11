/**
 * partnerListings.ts
 *
 * When a voting round starts, the restaurants come from Google Places. This file
 * checks each one's Google Place ID to see if it's run by an approved Fork Off
 * partner, and if so uses the partner's own information on the swipe card.
 *
 * A restaurant counts as a partner restaurant when an approved partner account
 * has it in restaurantIds (an admin linked them on the admin page). Pending,
 * rejected, or unclaimed restaurants are left exactly as Google returned them.
 *
 * For partner restaurants, each field uses the first one that's filled in:
 *   1. the restaurant's partnerDetails (editable after approval, via
 *      PATCH /api/restaurants/:id)
 *   2. what the partner entered on the sign-up form (user.requestedRestaurant)
 *   3. Google's value
 *
 *   Partner can replace: name, address, category (cuisine), price level
 *   Partner-only extras:  website, phone, service options (Dine-in, Takeout, ...)
 *   Always from Google:   photo, rating, reviews, hours, distance, Maps link
 */
import { Restaurant } from "../db_models/restaurant";
import { User } from "../db_models/user";

export type PartnerListing = { verified: true; website?: string; phone?: string; serviceOptions?: string[] };

// The fields of a round restaurant that partner info can change.
type CardFields = { id: string; name: string; address: string | null; category: string | null; priceLevel?: string | null };

// The card shows Google's price codes, so turn the partner's "$$" into the same format.
const googlePriceLevel: Record<string, string> = {
  "$": "PRICE_LEVEL_INEXPENSIVE",
  "$$": "PRICE_LEVEL_MODERATE",
  "$$$": "PRICE_LEVEL_EXPENSIVE",
};

const text = (value: unknown) => typeof value === "string" && value.trim() ? value.trim() : undefined;

// Only pass on http(s) links, so nothing else ends up in an <a href>.
function safeWebsite(value: unknown) {
  const website = text(value);
  if (!website) return undefined;
  try {
    const url = new URL(website);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : undefined;
  } catch {
    return undefined;
  }
}

// "1 Pier St, Erie, PA 16507" from the sign-up form's separate address fields.
function signUpAddress(requested: any) {
  const street = text(requested?.address);
  if (!street) return undefined;
  const cityLine = [text(requested.city), [text(requested.state), text(requested.postalCode)].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [street, cityLine].filter(Boolean).join(", ");
}

type PartnerInfo = {
  name?: string; address?: string; category?: string; priceLevel?: string;
  listing: PartnerListing;
};

/** Returns the partner info to use, by Google Place ID, for restaurants that have an approved partner. */
export async function partnerInfoFor(placeIds: string[]): Promise<Map<string, PartnerInfo>> {
  const info = new Map<string, PartnerInfo>();
  if (!placeIds.length) return info;

  const saved = await Restaurant.find({ placeId: { $in: placeIds } }).select("placeId partnerDetails").lean();
  if (!saved.length) return info;

  // Most recently updated first, so if two partners share a restaurant the newest info wins.
  const partners = await User.find({
    role: "partner",
    partnerStatus: "approved",
    restaurantIds: { $in: saved.map(restaurant => restaurant._id) },
  }).select("restaurantIds requestedRestaurant").sort({ updatedAt: -1 }).lean();

  for (const restaurant of saved) {
    const partner = partners.find(user => (user.restaurantIds ?? []).some(id => String(id) === String(restaurant._id)));
    if (!partner) continue;
    const details = (restaurant.partnerDetails ?? {}) as Record<string, unknown>;
    const requested = (partner.requestedRestaurant ?? {}) as Record<string, any>;
    const categories = Array.isArray(details.categories) ? details.categories : [];

    const website = safeWebsite(details.website) ?? safeWebsite(requested.website);
    const phone = text(details.phone) ?? text(requested.phone);
    const serviceOptions = Array.isArray(requested.serviceOptions) ? requested.serviceOptions.filter((value: unknown) => text(value)) : [];

    info.set(restaurant.placeId, {
      name: text(details.restaurantName) ?? text(requested.name),
      address: text(details.address) ?? signUpAddress(requested),
      category: text(categories[0]) ?? text(requested.cuisine),
      priceLevel: googlePriceLevel[requested.priceLevel],
      listing: {
        verified: true,
        ...(website ? { website } : {}),
        ...(phone ? { phone } : {}),
        ...(serviceOptions.length ? { serviceOptions } : {}),
      },
    });
  }
  return info;
}

/**
 * Returns the round's restaurants with partner info filled in for partner
 * restaurants (and a `partner` field so the card can show the badge).
 * If the lookup fails, the restaurants are returned unchanged: partner info
 * should never stop a round from starting.
 */
export async function withPartnerListings<T extends CardFields>(restaurants: T[]): Promise<(T & { partner?: PartnerListing })[]> {
  try {
    const info = await partnerInfoFor(restaurants.map(restaurant => restaurant.id));
    return restaurants.map(restaurant => {
      const partner = info.get(restaurant.id);
      if (!partner) return restaurant;
      return {
        ...restaurant,
        name: partner.name ?? restaurant.name,
        address: partner.address ?? restaurant.address,
        category: partner.category ?? restaurant.category,
        priceLevel: partner.priceLevel ?? restaurant.priceLevel,
        partner: partner.listing,
      };
    });
  } catch (error) {
    console.error("Could not load partner info:", error);
    return restaurants;
  }
}