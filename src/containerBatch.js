// Pure concurrency-limited worker pool -- no React, no DOM, so this is
// unit-testable on its own. Containers.jsx uses it for both "Check
// compatibility" (concurrency = every container at once, it's a cheap
// call) and "Run selected" (concurrency = 2, since a real assessment is
// ~199 checks against a real production container -- running many of
// those at once risks Docker daemon/CPU/I/O contention right when it
// matters most, during a live demo).
//
// `onSettle(item, result)` fires once per item, immediately as that
// item's own call resolves -- not after the whole batch finishes -- so a
// UI can update each card independently. `result` computation happens
// entirely inside its own try/catch, then `onSettle` is invoked outside
// that block: if `onSettle` itself threw while still inside the catch, it
// would be indistinguishable from `worker` having failed, mis-attributing
// the failure and firing onSettle a second time for the same item.
export async function runWithConcurrency(items, worker, concurrency, onSettle) {
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error('concurrency must be a positive integer')
  }

  let index = 0

  async function lane() {
    while (index < items.length) {
      const item = items[index++]
      let result
      try {
        result = { status: 'fulfilled', value: await worker(item) }
      } catch (error) {
        result = { status: 'rejected', reason: error }
      }
      onSettle(item, result)
    }
  }

  const laneCount = Math.min(concurrency, items.length)
  await Promise.all(Array.from({ length: laneCount }, () => lane()))
}
