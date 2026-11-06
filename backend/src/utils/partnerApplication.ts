/**
 * partnerApplication.ts
 *
 * The choices offered on the partner sign-up form, and the function that checks
 * and cleans up the restaurant part of a sign-up request.
 *
 * Cuisine and price use the same options as the lobby filters
 * (frontend/src/features/preferences/restaurantPreferences.ts), so what a partner
 * tells us lines up with what groups filter by. Keep these lists in sync with
 * frontend/src/features/partner/partnerOptions.ts.
 */
export const cuisineOptions = ["Italian", "Ramen", "Mexican", "American", "Asian", "Fast food", "Vegetarian", "Other"] as const;
export const priceLevelOptions = ["$", "$$", "$$$"] as const;
export const businessTypeOptions = ["Independent restaurant", "Franchise or chain location", "Food truck", "Ghost kitchen", "Other"] as const;
export const serviceOptions = ["Dine-in", "Takeout", "Delivery"] as const;
export const applicantRoleOptions = ["Owner", "General manager", "Marketing or staff", "Other"] as const;

export type RequestedRestaurant = {
  name: string;
  address: string;
  city: string;
  state: string;
  postalCode: string;
  phone: string;
  website?: string;
  cuisine: (typeof cuisineOptions)[number];
  priceLevel: (typeof priceLevelOptions)[number];
  businessType: (typeof businessTypeOptions)[number];
  serviceOptions: (typeof serviceOptions)[number][];
  applicantRole: (typeof applicantRoleOptions)[number];
  notes?: string;
};

// Only accept plain strings, trimmed and length-capped.
const text = (value: unknown, max: number) => typeof value === "string" && value.trim().length <= max ? value.trim() : "";
const oneOf = <T extends readonly string[]>(value: unknown, options: T): T[number] | "" =>
  typeof value === "string" && options.includes(value) ? value : "";

/**
 * Returns the cleaned-up restaurant details, or null if anything required is
 * missing or invalid. Unknown fields in the body are ignored.
 */
export function partnerRestaurantFields(body: any): RequestedRestaurant | null {
  const name = text(body?.restaurantName, 120);
  const address = text(body?.restaurantAddress, 200);
  const city = text(body?.city, 80);
  const state = text(body?.state, 2).toUpperCase();
  const postalCode = text(body?.postalCode, 10);
  const phone = text(body?.restaurantPhone, 30);
  const website = text(body?.website, 300);
  const cuisine = oneOf(body?.cuisine, cuisineOptions);
  const priceLevel = oneOf(body?.priceLevel, priceLevelOptions);
  const businessType = oneOf(body?.businessType, businessTypeOptions);
  const applicantRole = oneOf(body?.applicantRole, applicantRoleOptions);
  const notes = text(body?.notes, 500);
  const services = Array.isArray(body?.serviceOptions)
    ? body.serviceOptions.map((value: unknown) => oneOf(value, serviceOptions)).filter(Boolean)
    : [];

  if (!name || !address || !city || !cuisine || !priceLevel || !businessType || !applicantRole || services.length === 0) return null;
  if (!/^[A-Z]{2}$/.test(state)) return null;
  if (!/^\d{5}(-\d{4})?$/.test(postalCode)) return null;
  // At least 10 digits, allowing spaces, dashes, dots, parentheses and a leading +.
  if (!/^\+?[\d\s().-]+$/.test(phone) || phone.replace(/\D/g, "").length < 10) return null;
  if (website && !isWebsite(website)) return null;

  return {
    name, address, city, state, postalCode, phone,
    ...(website ? { website } : {}),
    cuisine, priceLevel, businessType,
    // Keep the form's order so admins always see them the same way.
    serviceOptions: serviceOptions.filter(option => services.includes(option)),
    applicantRole,
    ...(notes ? { notes } : {}),
  };
}

function isWebsite(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}