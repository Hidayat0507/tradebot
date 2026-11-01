/** Run at most `max` tasks at once; extra callers queue in FIFO order. */
export function createLimiter(max: number) {
  if (!Number.isInteger(max) || max < 1) throw new Error('max must be a positive integer')
  let active = 0
  const queue: Array<() => void> = []
  const next = () => {
    if (active >= max) return
    const run = queue.shift()
    if (run) { active++; run() }
  }
  const limit = <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        Promise.resolve().then(task).then(resolve, reject).finally(() => { active--; next() })
      })
      next()
    })
  return Object.defineProperties(limit, {
    active: { get: () => active }, pending: { get: () => queue.length },
  }) as typeof limit & { readonly active: number; readonly pending: number }
}

/** Shared cap across public batch tickers and single-symbol detail requests. */
export const publicMarketLimit = createLimiter(2)
