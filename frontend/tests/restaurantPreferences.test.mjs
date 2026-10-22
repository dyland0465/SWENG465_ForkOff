import test from 'node:test'
import assert from 'node:assert/strict'
import {
  defaultRestaurantPreferences, getPreferences, reducePreferences, preferencesFromFields,
  preferenceValidators, formatPreferenceSchedule, formatPreferenceTime, formatPreferenceDistance,
  formatPreferenceAvailability, preferenceSummary, hasDefaultPreferences,
} from '../src/features/preferences/restaurantPreferences.ts'

const custom = () => ({
  ...defaultRestaurantPreferences(), location: '  Pittsburgh, PA  ', date: '2026-12-04', time: '08:05',
  distance: 'any', rating: '4.5', cuisines: ['Mexican', 'Vegetarian'], prices: ['$', '$$$'],
  diningNeeds: ['Serves alcohol', 'Mocktails'], availability: 'openNow',
})

test('all screens share complete defaults; reset restores every field only in its scope', () => {
  const initial = new Map()
  const defaults = defaultRestaurantPreferences()
  assert.equal(defaults.date, '')
  assert.equal(defaults.availability, 'atDiningTime')
  assert.equal(hasDefaultPreferences(defaults), true)
  const edited = reducePreferences(initial, { type: 'apply', lobbyId: 'crew', preferences: custom() })
  const other = reducePreferences(edited, { type: 'apply', lobbyId: 'other', preferences: { ...custom(), time: '' } })
  const reset = reducePreferences(other, { type: 'reset', lobbyId: 'crew' })
  assert.deepEqual(getPreferences(reset, { lobbyId: 'crew' }), defaults)
  assert.equal(getPreferences(reset, { lobbyId: 'other' }).time, '')
  assert.equal(initial.size, 0)
  assert.equal(hasDefaultPreferences(getPreferences(edited, { lobbyId: 'crew' })), false)
})

test('multiple prices and all dining needs survive immutable apply without coercion', () => {
  const input = custom()
  const state = reducePreferences(new Map(), { type: 'apply', lobbyId: 'crew', preferences: input })
  const saved = getPreferences(state, { lobbyId: 'crew' })
  assert.equal(saved.location, 'Pittsburgh, PA')
  assert.deepEqual(saved.prices, ['$', '$$$'])
  assert.deepEqual(saved.diningNeeds, ['Serves alcohol', 'Mocktails'])
  input.prices.push('$$')
  assert.deepEqual(saved.prices, ['$', '$$$'])
  assert.notEqual(defaultRestaurantPreferences().prices, defaultRestaurantPreferences().prices)
  assert.deepEqual(preferencesFromFields(custom(), { ...custom(), prices: ['$$$', '$$', '$'] }).prices, ['$', '$$', '$$$'])
})

test('lobby and future round scopes preserve independent snapshots, including opaque IDs', () => {
  let state = new Map()
  const scopes = [
    { lobbyId: 'crew' }, { lobbyId: 'Crew' }, { lobbyId: 'crew', roundId: 'round/1' },
    { lobbyId: 'crew', roundId: '' }, { lobbyId: '__proto__' }, { lobbyId: 'crew/東京' },
  ]
  scopes.forEach((scope, i) => { state = reducePreferences(state, { ...scope, type: 'apply', preferences: { ...custom(), location: `City ${i}` } }) })
  scopes.forEach((scope, i) => assert.equal(getPreferences(state, scope).location, `City ${i}`))
  const reset = reducePreferences(state, { ...scopes[2], type: 'reset' })
  assert.deepEqual(getPreferences(reset, scopes[2]), defaultRestaurantPreferences())
  assert.equal(getPreferences(reset, scopes[0]).location, 'City 0')
  assert.deepEqual(getPreferences(reset, { lobbyId: 'unseen' }), defaultRestaurantPreferences())
})

test('form validation rejects invalid location/calendar/time/options rather than dropping them', () => {
  for (const [key, values] of Object.entries({
    location: ['', 'x', 'x'.repeat(121)], date: ['tomorrow', '2026-02-29', '2026-04-31', '2026-13-01'],
    time: ['24:00', '7:30', '19:60'], distance: ['2', ''], rating: ['5', ''], availability: ['open', ''],
  })) {
    for (const value of values) {
      assert.ok(preferenceValidators[key](value), `${key}: ${value}`)
      assert.throws(() => preferencesFromFields({ ...custom(), [key]: value }, custom()))
    }
  }
  for (const key of ['cuisines', 'prices', 'diningNeeds']) {
    assert.throws(() => preferencesFromFields(custom(), { ...custom(), [key]: ['unknown'] }))
  }
  assert.equal(preferenceValidators.date('2028-02-29'), undefined)
  // Demo calendar settings are stable, not changed automatically by the clock or timezone.
  assert.equal(preferenceValidators.date('2020-01-01'), undefined)
  const unrestricted = preferencesFromFields({ ...custom(), date: '', time: '', distance: 'any', rating: 'any', availability: 'any' }, { cuisines: [], prices: [], diningNeeds: [] })
  assert.equal(formatPreferenceSchedule(unrestricted), 'Any date · Any time')
})

test('all summaries agree about date, AM/PM, distance, prices and availability', () => {
  assert.equal(formatPreferenceTime('00:00'), '12:00 AM')
  assert.equal(formatPreferenceTime('12:00'), '12:00 PM')
  assert.equal(formatPreferenceTime('19:30'), '7:30 PM')
  assert.equal(formatPreferenceDistance('1'), 'Within 1 mile')
  assert.equal(formatPreferenceDistance('any'), 'Any distance')
  assert.equal(formatPreferenceSchedule(custom()), 'Dec 4, 2026 · 8:05 AM')
  assert.equal(formatPreferenceAvailability('openNow'), 'Open now')
  assert.equal(formatPreferenceAvailability('atDiningTime'), 'Open at dining time')
  const summary = preferenceSummary(preferencesFromFields(custom(), custom()))
  for (const part of ['Pittsburgh, PA', 'Dec 4, 2026', '8:05 AM', 'Any distance', '$ / $$$', '4.5+', 'Open now', 'Serves alcohol', 'Mocktails']) assert.ok(summary.includes(part), part)
  assert.equal(hasDefaultPreferences({ ...defaultRestaurantPreferences(), cuisines: ['Ramen', 'Italian'] }), true)
})
