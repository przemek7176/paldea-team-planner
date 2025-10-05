/// <reference lib="webworker" />
// Minimal worker: merge + dedupe + sort; optional progress pings.

type TM = { tm_number: number; move?: { name?: string | null } | null }

interface Msg {
  current: any[]           // current owned array (numbers or strings)
  catalog: TM[]            // full TM catalog
  shape: 'number' | 'name' // desired storage shape
  progressEvery?: number   // optional: send progress pings every N items
}

self.onmessage = (e: MessageEvent<Msg>) => {
  const { current, catalog, shape, progressEvery = 50 } = e.data

  // Key extractor for output shape
  const keyOf = (tm: TM) => shape === 'number' ? tm.tm_number : (tm.move?.name ?? '')
  const isValid = (k: any) => (shape === 'number' ? typeof k === 'number' && !Number.isNaN(k) : typeof k === 'string' && k)

  // Seed set from current
  const set = new Set<any>(Array.isArray(current) ? current : [])

  // Merge
  let i = 0
  for (const tm of catalog) {
    const k = keyOf(tm)
    if (isValid(k)) set.add(k)
    if (++i % progressEvery === 0) {
      // Non-blocking progress hints
      // @ts-ignore
      self.postMessage({ type: 'progress', done: i, total: catalog.length })
    }
  }

  // Stable, ascending sort for numbers; lexicographic for names
  const merged = Array.from(set)
  if (shape === 'number') merged.sort((a: number, b: number) => a - b)
  else merged.sort()

  // @ts-ignore
  self.postMessage({ type: 'done', merged })
}
