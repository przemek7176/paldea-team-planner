import TmMergeWorker from '../workers/tmMerge.worker?worker'
import type { TmEntry } from '../data/tmCatalog'  // from the loader we added

// Read/Write with fallbacks that preserve your existing key & shape.
function readOwnedMoves(): any[] {
  try {
    const raw = localStorage.getItem('ownedMoves')
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}
function writeOwnedMoves(v: any[]) {
  try { localStorage.setItem('ownedMoves', JSON.stringify(v)) } catch {}
}

/** Detect storage shape so we don't change your schema by accident. */
function detectShape(arr: any[]): 'number' | 'name' {
  if (!arr || !arr.length) return 'number' // default if empty
  return (typeof arr[0] === 'number') ? 'number' : 'name'
}

/**
 * Add all TMs in one fast operation:
 * - Runs merge in a Web Worker (no UI jank)
 * - Single localStorage write + single React state update
 * - Optional onProgress for a lightweight progress bar
 */
export async function addAllTMsFast(
  catalog: TmEntry[],
  setOwnedMovesState: (next: any[]) => void,
  onProgress?: (done: number, total: number) => void
): Promise<void> {
  const current = readOwnedMoves()
  const shape = detectShape(current) // keep your current schema

  const worker = new TmMergeWorker()
  const merged: any[] = await new Promise((resolve, reject) => {
    worker.onmessage = (ev: MessageEvent<any>) => {
      const msg = ev.data
      if (msg?.type === 'progress') {
        onProgress?.(msg.done, msg.total)
      } else if (msg?.type === 'done') {
        resolve(msg.merged)
        worker.terminate()
      }
    }
    worker.onerror = err => { worker.terminate(); reject(err) }
    worker.postMessage({
      current,
      catalog: catalog.map(tm => ({ tm_number: tm.tm_number, move: tm.move })), // slim payload
      shape,
      progressEvery: 64,
    })
  })

  // Single write + single state update (no flicker)
  writeOwnedMoves(merged)
  // If you're on React 18, you can wrap in startTransition for extra smoothness
  setOwnedMovesState(merged)
}
