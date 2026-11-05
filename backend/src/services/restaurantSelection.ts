import { randomInt } from 'node:crypto'

/** Shuffle a copy so selecting restaurants never changes the cached search order. */
export function shuffled<T>(items: readonly T[], chooseIndex: (upperBound: number) => number = randomInt): T[] {
  const result = [...items]
  for (let index = result.length - 1; index > 0; index--) {
    const swap = chooseIndex(index + 1)
    ;[result[index], result[swap]] = [result[swap], result[index]]
  }
  return result
}

export function chooseRestaurants<T extends { id: string }>(matches: readonly T[], previous: readonly T[], limit = 10, chooseIndex?: (upperBound: number) => number): T[] {
  return [...shuffled(matches, chooseIndex), ...shuffled(previous, chooseIndex)].slice(0, limit)
}
