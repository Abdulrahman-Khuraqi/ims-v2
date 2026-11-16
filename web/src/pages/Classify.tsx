import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, Plus, Repeat, Search, Sparkles, Wand2, X } from 'lucide-react'
import { api, errorMessage } from '../api'
import { useApp } from '../context'
import { useFeedback } from '../components/Feedback'
import { NewItemForm } from '../components/ItemPicker'
import { Page, TopBar } from '../components/Layout'
import { Sheet } from '../components/Sheet'
import { Button, Card, EmptyState, Input, Money, PageLoader, StoreDot, cx } from '../components/ui'
import { fmtDateTime, money } from '../lib/format'
import type { CatalogItem, Invoice, InvoiceList } from '../types'

/** One selected service on the current invoice. `manual` = the user typed this price; auto lines share the rest. */
interface Line {
  item_id: number
  price: number
  manual: boolean
}

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Splits the invoice amount: typed (manual) prices stay, the remainder is shared by the other lines
 * in proportion to their catalog prices (equally when a price is missing). The last auto line takes
 * the rounding so the lines always add up to the amount.
 */
function split(lines: Line[], amount: number, priceOf: (id: number) => number | null): Line[] {
  const auto = lines.filter((l) => !l.manual)
  if (!auto.length) return lines
  const rest = Math.max(0, cents(amount - lines.filter((l) => l.manual).reduce((s, l) => s + l.price, 0)))
  const weights = auto.map((l) => priceOf(l.item_id))
  const w = weights.every((x) => x && x > 0) ? (weights as number[]) : auto.map(() => 1)
  const total = w.reduce((a, b) => a + b, 0)
  // Whole riyals when the amount to share is whole (500 → 326 + 174, not 326.09 + 173.91).
  const round = Number.isInteger(rest) ? Math.round : cents
  let given = 0
  const prices = auto.map((_, i) => {
    if (i === auto.length - 1) return cents(rest - given)
    const p = round((rest * w[i]) / total)
    given = cents(given + p)
    return p
  })
  let k = 0
  return lines.map((l) => (l.manual ? l : { ...l, price: prices[k++] }))
}

export default function Classify() {
  const { items, categories, currentStore, storeById, reloadCatalog } = useApp()
  const { toast } = useFeedback()
  const navigate = useNavigate()
  const [queue, setQueue] = useState<Invoice[] | null>(null)
  const [total, setTotal] = useState(0)
  const [index, setIndex] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(0)
  const [last, setLast] = useState<number[]>([])
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setQueue(null)
    try {
      const r = await api<InvoiceList>('invoices', { query: { unclassified: 1, store: currentStore, per_page: 500, sort: 'paid_desc' } })
      setQueue(r.invoices)
      setTotal(r.total)
      setIndex(0)
    } catch (e) {
      toast(errorMessage(e), 'error')
      setQueue([])
    }
  }, [currentStore, toast])
  useEffect(() => {
    load()
  }, [load])

  const inv = queue?.[index] ?? null
  useEffect(() => {
    setLines([])
    setQ('')
  }, [inv?.id])

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const priceOf = useCallback((id: number) => itemById.get(id)?.default_price ?? null, [itemById])

  /** Services usable on this invoice's store, grouped by category in catalog order. */
  const groups = useMemo(() => {
    if (!inv) return []
    const term = q.trim().toLowerCase()
    const usable = items
      .filter((i) => i.is_active && (i.store_id === null || i.store_id === inv.store_id))
      .filter((i) => !term || i.name.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term))
    const byCat = new Map<number | null, CatalogItem[]>()
    for (const i of usable) byCat.set(i.category_id, [...(byCat.get(i.category_id) ?? []), i])
    const ordered = [...categories].sort((a, b) => a.sort - b.sort || a.id - b.id)
    const out = ordered.filter((c) => byCat.has(c.id)).map((c) => ({ key: String(c.id), name: c.name, color: c.color, items: byCat.get(c.id)! }))
    if (byCat.has(null)) out.push({ key: 'none', name: 'بدون تصنيف', color: '#64748b', items: byCat.get(null)! })
    for (const g of out) g.items.sort((a, b) => b.usage_count - a.usage_count || (a.default_price ?? 0) - (b.default_price ?? 0))
    return out
  }, [items, categories, inv, q])

  const suggested = useMemo(
    () => (inv ? items.filter((i) => i.is_active && (i.store_id === null || i.store_id === inv.store_id) && i.default_price === inv.amount) : []),
    [items, inv],
  )

  const setAndSplit = (next: Line[]) => inv && setLines(split(next, inv.amount, priceOf))

  const toggle = (id: number) => {
    if (!inv) return
    const has = lines.some((l) => l.item_id === id)
    setAndSplit(has ? lines.filter((l) => l.item_id !== id) : [...lines, { item_id: id, price: 0, manual: false }])
  }

  const editPrice = (id: number, value: string) => {
    const n = parseFloat(value.replace(/[^\d.]/g, ''))
    setAndSplit(lines.map((l) => (l.item_id === id ? { ...l, price: isNaN(n) ? 0 : cents(n), manual: true } : l)))
  }

  const resetSplit = () => setAndSplit(lines.map((l) => ({ ...l, manual: false })))

  const repeatLast = () => {
    if (!inv) return
    const valid = last.filter((id) => {
      const i = itemById.get(id)
      return i && i.is_active && (i.store_id === null || i.store_id === inv.store_id)
    })
    setAndSplit(valid.map((id) => ({ item_id: id, price: 0, manual: false })))
  }

  const sum = cents(lines.reduce((s, l) => s + l.price, 0))
  const remaining = inv ? cents(inv.amount - sum) : 0
  const canSave = !!inv && lines.length > 0 && Math.abs(remaining) < 0.01 && !saving

  const save = useCallback(async () => {
    if (!inv || !canSave) return
    setSaving(true)
    try {
      await api(`invoices/${inv.id}`, { method: 'PUT', body: { items: lines.map((l) => ({ item_id: l.item_id, qty: 1, unit_price: l.price })) } })
      setLast(lines.map((l) => l.item_id))
      setDone((d) => d + 1)
      setTotal((t) => t - 1)
      // The saved invoice leaves the queue; the next one slides into the same position.
      setQueue((qq) => (qq ? qq.filter((x) => x.id !== inv.id) : qq))
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }, [inv, canSave, lines, toast])

  // Desktop: Enter saves (except while typing in the search box).
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter' || (e.target as HTMLElement)?.getAttribute?.('type') === 'search') return
      e.preventDefault()
      save()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [save])

  const storeName = storeById(currentStore)?.name

  if (!queue) {
    return (
      <>
        <TopBar title="تصنيف سريع" back switcher />
        <PageLoader />
      </>
    )
  }

  if (!inv) {
    return (
      <>
        <TopBar title="تصنيف سريع" back switcher />
        <Page>
          <EmptyState
            icon={<Check className="size-10" />}
            title={queue.length ? 'وصلت لنهاية القائمة' : 'لا توجد فواتير غير مصنّفة'}
            text={
              queue.length
                ? `بقيت ${queue.length} فاتورة تخطيتها.`
                : `${done ? `صنّفت ${done} فاتورة في هذه الجلسة. ` : ''}${storeName ? `كل فواتير ${storeName} مصنّفة.` : 'كل الفواتير مصنّفة.'}`
            }
            action={
              queue.length ? (
                <Button onClick={() => setIndex(0)}>ارجع للفواتير التي تخطيتها</Button>
              ) : (
                <Button variant="secondary" onClick={() => navigate('/invoices')}>
                  الفواتير
                </Button>
              )
            }
          />
        </Page>
      </>
    )
  }

  const store = storeById(inv.store_id)

  return (
    <>
      <TopBar title="تصنيف سريع" back switcher />
      <Page>
        <div className="mb-3 flex items-center justify-between px-1 text-[14px] text-muted">
          <span>
            متبقية <span className="num font-semibold text-fg">{total}</span>
            {done > 0 && (
              <>
                {' '}· صنّفت <span className="num font-semibold text-success">{done}</span>
              </>
            )}
          </span>
          <span className="flex items-center gap-1">
            <button aria-label="السابقة" disabled={index === 0} onClick={() => setIndex((i) => Math.max(0, i - 1))} className="flex size-9 items-center justify-center rounded-full disabled:opacity-30">
              <ChevronRight className="size-5" />
            </button>
            <span className="num">
              {index + 1} / {queue.length}
            </span>
            <button aria-label="التالية" disabled={index >= queue.length - 1} onClick={() => setIndex((i) => i + 1)} className="flex size-9 items-center justify-center rounded-full disabled:opacity-30">
              <ChevronLeft className="size-5" />
            </button>
          </span>
        </div>

        {/* The invoice */}
        <Card className="mb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-[18px] font-bold" dir="auto">
                {inv.customer_name || 'بدون اسم'}
              </p>
              {inv.email && (
                <p className="truncate text-[14px] text-muted" dir="ltr">
                  {inv.email}
                </p>
              )}
              <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                <span className="flex items-center gap-1">
                  <StoreDot color={store?.color ?? inv.store_color} /> {inv.store_name}
                </span>
                <span>{fmtDateTime(inv.paid_at)}</span>
                {(inv.reference_no || inv.invoice_no) && <span className="num">{inv.invoice_no || inv.reference_no}</span>}
              </p>
            </div>
            <Money value={inv.amount} className="shrink-0 text-[26px] font-bold" />
          </div>
          {inv.note && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">{inv.note}</p>}
        </Card>

        {/* Quick picks */}
        {(suggested.length > 0 || last.length > 0) && (
          <div className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4">
            {last.length > 0 && (
              <button onClick={repeatLast} className="flex shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-2 text-[14px] font-medium">
                <Repeat className="size-4 text-primary" /> نفس السابقة
              </button>
            )}
            {suggested.map((i) => (
              <button
                key={i.id}
                onClick={() => toggle(i.id)}
                className={cx(
                  'flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[14px] font-medium',
                  lines.some((l) => l.item_id === i.id) ? 'border-primary bg-primary text-primary-fg' : 'border-primary/40 bg-primary-soft text-primary',
                )}
              >
                <Sparkles className="size-4" /> {i.name}
              </button>
            ))}
          </div>
        )}

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن خدمة…" className="ps-12" enterKeyHint="search" />
        </div>

        {/* Services */}
        <div className="space-y-4">
          {groups.map((g) => (
            <section key={g.key}>
              <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted">
                <span className="size-2 rounded-full" style={{ background: g.color }} /> {g.name}
              </p>
              <div className="grid grid-cols-2 gap-2">
                {g.items.map((i) => {
                  const on = lines.some((l) => l.item_id === i.id)
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggle(i.id)}
                      className={cx(
                        'rounded-2xl border p-3 text-start transition active:scale-[0.98]',
                        on ? 'border-primary bg-primary-soft ring-2 ring-primary/30' : 'border-line bg-surface',
                      )}
                    >
                      <span className="flex items-start gap-1.5">
                        <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug" dir="auto">
                          {i.name}
                        </span>
                        {on && (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-primary-fg">
                            <Check className="size-3.5" />
                          </span>
                        )}
                      </span>
                      {i.description && <span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-muted">{i.description}</span>}
                      {i.default_price != null && <span className="num mt-1 block text-[12px] font-semibold text-muted">{money(i.default_price)} ر.س</span>}
                    </button>
                  )
                })}
              </div>
            </section>
          ))}
          <Button variant="soft" block icon={<Plus className="size-5" />} onClick={() => setCreating(true)}>
            خدمة جديدة
          </Button>
        </div>
        {/* Room for the action bar, which grows with the selected services. */}
        <div style={{ height: 120 + Math.min(lines.length, 4) * 46 }} />
      </Page>

      {/* Selection + actions, always visible */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgb(0_0_0/0.06)] backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          {lines.length > 0 ? (
            <div className="mb-3 max-h-44 space-y-1.5 overflow-y-auto">
              {lines.map((l) => (
                <div key={l.item_id} className="flex items-center gap-2">
                  <button aria-label="إزالة" onClick={() => toggle(l.item_id)} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted">
                    <X className="size-4" />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium" dir="auto">
                    {itemById.get(l.item_id)?.name}
                  </span>
                  <div className="w-28 shrink-0">
                    <Input
                      inputMode="decimal"
                      value={String(l.price)}
                      onChange={(e) => editPrice(l.item_id, e.target.value)}
                      onFocus={(e) => e.target.select()}
                      className={cx('num h-10 text-end text-[15px]', l.manual && 'border-primary')}
                    />
                  </div>
                </div>
              ))}
              <div className="flex items-center justify-between px-1 pt-1 text-[13px]">
                {Math.abs(remaining) < 0.01 ? (
                  <span className="text-success">المجموع يساوي مبلغ الفاتورة</span>
                ) : (
                  <span className="text-danger">
                    {remaining > 0 ? 'متبقي' : 'زيادة'} <span className="num font-semibold">{money(Math.abs(remaining))}</span> ر.س
                  </span>
                )}
                {lines.some((l) => l.manual) && (
                  <button onClick={resetSplit} className="flex items-center gap-1 font-semibold text-primary">
                    <Wand2 className="size-4" /> وزّع تلقائياً
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="mb-3 text-center text-[14px] text-muted">اختر خدمة أو أكثر، والمبلغ يتوزع عليها تلقائياً</p>
          )}
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" onClick={() => setIndex((i) => i + 1)}>
              تخطي
            </Button>
            <Button block size="lg" loading={saving} disabled={!canSave} onClick={save}>
              حفظ والتالي
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="خدمة جديدة">
        {creating && (
          <NewItemForm
            defaultName={q}
            storeId={inv.store_id}
            onCancel={() => setCreating(false)}
            onCreated={async (item) => {
              setCreating(false)
              await reloadCatalog()
              setAndSplit([...lines, { item_id: item.id, price: 0, manual: false }])
            }}
          />
        )}
      </Sheet>
    </>
  )
}
