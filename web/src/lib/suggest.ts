import type { CatalogItem, Invoice } from '../types'

/** A service with a quantity, e.g. 5 × "Social media post". */
export interface PickLine {
  item_id: number
  qty: number
}

export interface Suggestion {
  key: string
  kind: 'history' | 'exact' | 'near' | 'qty' | 'pair' | 'popular'
  lines: PickLine[]
  /** history: how many earlier invoices of this amount were classified this way. */
  count?: number
  /** qty: the price per unit this suggestion implies (shown when it differs from the catalog price). */
  unit?: number
}

const halalas = (n: number) => Math.round(n * 100)
const signature = (lines: PickLine[]) =>
  lines
    .map((l) => `${l.item_id}x${l.qty}`)
    .sort()
    .join('+')

/** How far a price may be from the catalog price and still count as "about that service". */
const TOLERANCE = 0.2
/** Services up to this price are sold by the piece (posts, cards…) and can be suggested as N ×. */
const UNIT_MAX_PRICE = 400
const MAX_QTY = 30

/** amount (in halalas) → how each set of services was used for that amount. */
export type History = Map<number, Map<string, { lines: PickLine[]; count: number }>>

export function buildHistory(invoices: Invoice[]): History {
  const h: History = new Map()
  for (const inv of invoices) if (inv.lines.length) addToHistory(h, inv.amount, inv.lines.map((l) => ({ item_id: l.item_id, qty: l.qty })))
  return h
}

export function addToHistory(h: History, amount: number, lines: PickLine[]) {
  const key = halalas(amount)
  const byAmount = h.get(key) ?? new Map()
  const sig = signature(lines)
  const e = byAmount.get(sig) ?? { lines, count: 0 }
  e.count++
  byAmount.set(sig, e)
  h.set(key, byAmount)
}

/**
 * Ways to read an invoice amount as the store's services, most likely first:
 *  1. how invoices with exactly this amount were classified before (your own patterns),
 *  2. one service priced exactly at the amount,
 *  3. one service priced close to it (within 20%),
 *  4. N × a by-the-piece service, at a whole unit price close to its catalog price (500 → 5 × post at 100),
 *  5. two services whose prices add up to the amount,
 *  6. the store's most used services.
 */
export function suggest(amount: number, usable: CatalogItem[], history: History, max = 6): Suggestion[] {
  const out: Suggestion[] = []
  const seen = new Set<string>()
  const ids = new Set(usable.map((i) => i.id))
  const push = (s: Suggestion) => {
    const sig = signature(s.lines)
    if (seen.has(sig) || out.length >= max) return
    seen.add(sig)
    out.push(s)
  }
  const target = halalas(amount)
  const priced = usable.filter((i) => i.default_price && i.default_price > 0).sort((a, b) => b.usage_count - a.usage_count)
  const off = (price: number, wanted: number) => Math.abs(price - wanted) / wanted

  // 1. your own patterns for this exact amount
  const past = [...(history.get(target)?.values() ?? [])].filter((e) => e.lines.every((l) => ids.has(l.item_id))).sort((a, b) => b.count - a.count)
  for (const e of past.slice(0, 3)) push({ key: 'h' + signature(e.lines), kind: 'history', lines: e.lines, count: e.count })

  // 2. exact price
  for (const i of priced) if (halalas(i.default_price!) === target) push({ key: 'e' + i.id, kind: 'exact', lines: [{ item_id: i.id, qty: 1 }] })

  // 3. close price
  priced
    .filter((i) => halalas(i.default_price!) !== target && off(amount, i.default_price!) <= TOLERANCE)
    .sort((a, b) => off(amount, a.default_price!) - off(amount, b.default_price!))
    .slice(0, 2)
    .forEach((i) => push({ key: 'n' + i.id, kind: 'near', lines: [{ item_id: i.id, qty: 1 }] }))

  // 4. N × a by-the-piece service, preferring whole unit prices nearest the catalog price
  const pieces = priced
    // Only services sold by the piece (posts, covers…); ready-made packs are bought one at a time.
    .filter((i) => i.kind === 'service' && i.default_price! <= UNIT_MAX_PRICE)
    .map((i) => {
      let best: { n: number; unit: number; d: number } | null = null
      for (let n = 2; n <= MAX_QTY; n++) {
        const unit = amount / n
        const d = off(unit, i.default_price!)
        if (Number.isInteger(unit) && d <= TOLERANCE && (!best || d < best.d)) best = { n, unit, d }
      }
      return best && { i, ...best }
    })
    .filter((x): x is NonNullable<typeof x> => !!x)
    .sort((a, b) => a.d - b.d || b.i.usage_count - a.i.usage_count)
  for (const p of pieces.slice(0, 3)) push({ key: `q${p.i.id}x${p.n}`, kind: 'qty', lines: [{ item_id: p.i.id, qty: p.n }], unit: p.unit })

  // 5. two services that add up exactly
  let pairs = 0
  for (let a = 0; a < priced.length && pairs < 2; a++) {
    for (let b = a + 1; b < priced.length && pairs < 2; b++) {
      if (halalas(priced[a].default_price!) + halalas(priced[b].default_price!) === target) {
        push({ key: `p${priced[a].id}-${priced[b].id}`, kind: 'pair', lines: [{ item_id: priced[a].id, qty: 1 }, { item_id: priced[b].id, qty: 1 }] })
        pairs++
      }
    }
  }

  // 6. what this store sells most
  usable
    .filter((i) => i.usage_count > 0)
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 2)
    .forEach((i) => push({ key: 'u' + i.id, kind: 'popular', lines: [{ item_id: i.id, qty: 1 }] }))

  return out
}
