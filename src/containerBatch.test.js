import { describe, expect, it } from 'vitest'
import { runWithConcurrency } from './containerBatch.js'

describe('runWithConcurrency', () => {
  it('never runs more than `concurrency` workers at once', async () => {
    const items = [1, 2, 3, 4, 5]
    let inFlight = 0
    let maxInFlight = 0

    await runWithConcurrency(
      items,
      async () => {
        inFlight++
        maxInFlight = Math.max(maxInFlight, inFlight)
        await new Promise((r) => setTimeout(r, 5))
        inFlight--
      },
      2,
      () => {},
    )

    expect(maxInFlight).toBeLessThanOrEqual(2)
  })

  it('processes every item exactly once', async () => {
    const items = ['a', 'b', 'c', 'd']
    const seen = []

    await runWithConcurrency(
      items,
      async (item) => item,
      2,
      (item) => seen.push(item),
    )

    expect(seen.sort()).toEqual(['a', 'b', 'c', 'd'])
  })

  it('a rejected worker does not cancel or block the others', async () => {
    const items = [1, 2, 3]
    const results = {}

    await runWithConcurrency(
      items,
      async (item) => {
        if (item === 2) throw new Error('boom')
        return item * 10
      },
      3,
      (item, result) => {
        results[item] = result
      },
    )

    expect(results[1]).toEqual({ status: 'fulfilled', value: 10 })
    expect(results[2].status).toBe('rejected')
    expect(results[2].reason.message).toBe('boom')
    expect(results[3]).toEqual({ status: 'fulfilled', value: 30 })
  })

  it('calls onSettle exactly once per item, even if onSettle itself throws', async () => {
    // Regression: onSettle must be invoked outside the worker's own
    // try/catch -- otherwise a throwing onSettle looks like a failed
    // worker and gets invoked a second time for the same item.
    const items = [1]
    let callCount = 0

    await expect(
      runWithConcurrency(
        items,
        async () => 'ok',
        1,
        () => {
          callCount++
          throw new Error('onSettle blew up')
        },
      ),
    ).rejects.toThrow('onSettle blew up')

    expect(callCount).toBe(1)
  })

  it('rejects immediately with a non-positive concurrency', async () => {
    await expect(runWithConcurrency([1, 2], async (x) => x, 0, () => {})).rejects.toThrow(
      'concurrency must be a positive integer',
    )
  })

  it('rejects immediately with a non-integer concurrency', async () => {
    await expect(runWithConcurrency([1, 2], async (x) => x, 1.5, () => {})).rejects.toThrow(
      'concurrency must be a positive integer',
    )
  })

  it('an empty item list resolves without calling the worker', async () => {
    let called = false

    await runWithConcurrency(
      [],
      async () => {
        called = true
      },
      2,
      () => {},
    )

    expect(called).toBe(false)
  })
})
