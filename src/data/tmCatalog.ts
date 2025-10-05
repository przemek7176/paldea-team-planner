// src/data/tmCatalog.ts
export type TmMove = {
  name: string
  id: number
  type: string | null
  damage_class: string | null
  power: number | null
  accuracy: number | null
  pp: number | null
}

export type TmEntry = {
  machine_id: number
  item: string      // "tm123"
  tm_number: number // 123
  move: TmMove
}

export type TmCatalog = {
  version: string
  source: string
  generatedAt: string
  count: number
  tms: TmEntry[]
}

let _tmCatalogMap: Map<number, TmEntry> | null = null
let _tmCatalogRaw: TmCatalog | null = null

/** Loads local JSON instantly; falls back to live PokeAPI build if missing (optional). */
export async function ensureTMSet(): Promise<Map<number, TmEntry>> {
  if (_tmCatalogMap) return _tmCatalogMap

  try {
    const r = await fetch('/data/sv_tm_catalog_v1.json', { cache: 'force-cache' })
    if (!r.ok) throw new Error('local TM catalog not found')
    _tmCatalogRaw = await r.json()
    _tmCatalogMap = new Map<number, TmEntry>()
    for (const e of _tmCatalogRaw.tms) _tmCatalogMap.set(e.tm_number, e)
    ;(window as any)._tmCatalog = _tmCatalogMap
    ;(window as any).ensureTMSet = ensureTMSet
    console.log(`[TM] Loaded local catalog v${_tmCatalogRaw.version} (${_tmCatalogRaw.count})`)
    return _tmCatalogMap
  } catch (e) {
    console.warn('[TM] Local catalog missing; falling back to live (slower).', e)
    // Minimal, optional live fallback: you can call a lazy loader here or just throw.
    throw e
  }
}

export function getTM(n: number): TmEntry | undefined {
  return _tmCatalogMap?.get(n)
}

export function allTMs(): TmEntry[] {
  return _tmCatalogRaw?.tms ?? []
}
