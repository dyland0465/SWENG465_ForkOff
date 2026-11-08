/**
 * partnerOptions.ts
 *
 * The choices on the partner sign-up form. These must match what the server
 * accepts (backend/src/utils/partnerApplication.ts). Cuisine and price reuse the
 * lobby filter options so a partner's answers line up with what groups filter by.
 */
import { cuisineOptions as lobbyCuisines, priceOptions } from '../preferences/restaurantPreferences'

export const partnerCuisineOptions = [...lobbyCuisines, 'Other'] as const
export const partnerPriceOptions = priceOptions
export const businessTypeOptions = ['Independent restaurant', 'Franchise or chain location', 'Food truck', 'Ghost kitchen', 'Other'] as const
export const serviceOptions = ['Dine-in', 'Takeout', 'Delivery'] as const
export const applicantRoleOptions = ['Owner', 'General manager', 'Marketing or staff', 'Other'] as const

export type ServiceOption = typeof serviceOptions[number]

/** US state and DC codes for the state dropdown. */
export const stateOptions = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD',
  'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const