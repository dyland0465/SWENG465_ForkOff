import { strict as assert } from 'node:assert'
import { test } from 'node:test'
import { chooseRestaurants, shuffled } from '../src/services/restaurantSelection'

test('shuffle selects from across the pool without modifying the input', () => {
  const source = [1, 2, 3, 4]
  assert.deepEqual(shuffled(source, () => 0), [2, 3, 4, 1])
  assert.deepEqual(source, [1, 2, 3, 4])
})

test('selection favors new matches and fills remaining spots from previous matches', () => {
  const fresh = [{ id: 'a' }, { id: 'b' }]
  const previous = [{ id: 'c' }, { id: 'd' }]
  assert.deepEqual(chooseRestaurants(fresh, previous, 3, upper => upper - 1).map(item => item.id), ['a', 'b', 'c'])
  assert.equal(chooseRestaurants(fresh, previous, 10).length, 4)
})
