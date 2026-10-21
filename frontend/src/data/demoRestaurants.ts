import harborPhoto from '../assets/figma/discovery/harbor-and-hearth.png'
import ramenPhoto from '../assets/figma/discovery/north-pier-ramen.png'
import bowlsPhoto from '../assets/figma/discovery/copper-bowl-kitchen.png'

export type DemoRestaurant = {
  id: string
  name: string
  cuisine: string
  price: string
  rating: string
  distanceMiles: string
  photo: string
  features: readonly string[]
  /** Optional Figma fixtures, never verified address, hours, or live availability. */
  sampleDetails?: {
    address: string
    dailyHours: string
    weeklyHours: string
    description: string
  }
}

/** Figma fixtures only: never live search results or verified restaurant data. */
export const demoRestaurants: readonly DemoRestaurant[] = [
  { id: 'harbor', name: 'Harbor & Hearth', cuisine: 'New American', price: '$$', rating: '4.7', distanceMiles: '0.8', photo: harborPhoto, features: ['Open now'] },
  {
    id: 'ramen', name: 'North Pier Ramen', cuisine: 'Japanese', price: '$$', rating: '4.8', distanceMiles: '1.4', photo: ramenPhoto, features: ['Open now', 'Mocktails', 'Vegetarian options'],
    sampleDetails: {
      address: '42 State Street, Erie, PA 16501',
      dailyHours: '11:00 AM–10:00 PM',
      weeklyHours: 'Mon–Thu 11–9 · Fri–Sat 11–10 · Sun 12–8',
      description: 'Japanese cuisine with mocktails and vegetarian options.',
    },
  },
  { id: 'bowls', name: 'Copper Bowl Kitchen', cuisine: 'Bowls', price: '$$', rating: '4.6', distanceMiles: '2.1', photo: bowlsPhoto, features: ['Open now'] },
]

// Start with the Voting frame's restaurant, keeping the same IDs and objects.
export const votingRestaurants = [demoRestaurants[1], demoRestaurants[0], demoRestaurants[2]] as const
