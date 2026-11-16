import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, ChevronLeft, ChevronRight, FlaskConical, History as HistoryIcon, Minus, Plus, Repeat, Search, Sparkles, Trash2, TrendingUp, Wand2, X } from 'lucide-react'
import { api, errorMessage } from '../api'
import { useApp } from '../context'
import { useFeedback } from '../components/Feedback'
import { NewItemForm } from '../components/ItemPicker'
import { Page, TopBar } from '../components/Layout'
import { Sheet } from '../components/Sheet'
import { Button, Card, EmptyState, Field, Input, Money, PageLoader, StoreDot, cx } from '../components/ui'
import { fmtDateTime, money } from '../lib/format'
import { TEST_MAX_AMOUNT } from '../lib/invoiceCheck'
import { addToHistory, buildHistory, suggest, type History, type PickLine, type Suggestion } from '../lib/suggest'
import type { CatalogItem, Invoice, InvoiceList } from '../types'

/** One selected service on the current invoice. `price` is the line total; `manual` = typed by the user. */
interface Line {
  item_id: number
  qty: number
  price: number
  manual: boolean
}

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Splits the invoice amount: typed (manual) totals stay, the remainder is shared by the other lines
 * in proportion to catalog price × quantity (by quantity when a price is missing). Whole riyals when
 * the shared amount is whole; the last auto line takes the rounding so the lines add up exactly.
 */
function split(lines: Line[], amount: number, priceOf: (id: number) => number | null): Line[] {
  const auto = lines.filter((l) => !l.manual)
  if (!auto.length) return lines
  const rest = Math.max(0, cents(amount - lines.filter((l) => l.manual).reduce((s, l) => s + l.price, 0)))
  const prices = auto.map((l) => priceOf(l.item_id))
  const w = prices.every((p) => p && p > 0) ? auto.map((l, i) => prices[i]! * l.qty) : auto.map((l) => l.qty)
  const total = w.reduce((a, b) => a + b, 0)
  const round = Number.isInteger(rest) ? Math.round : cents
  let given = 0
  const out = auto.map((_, i) => {
    if (i === auto.length - 1) return cents(rest - given)
    const p = round((rest * w[i]) / total)
    given = cents(given + p)
    return p
  })
  let k = 0
  return lines.map((l) => (l.manual ? l : { ...l, price: out[k++] }))
}

export default function Classify() {
  const { items, categories, currentStore, storeById, reloadCatalog } = useApp()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [queue, setQueue] = useState<Invoice[] | null>(null)
  const [total, setTotal] = useState(0)
  const [index, setIndex] = useState(0)
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(0)
  const [last, setLast] = useState<PickLine[]>([])
  const [history, setHistory] = useState<History>(new Map())
  const [creating, setCreating] = useState(false)
  const [testsOpen, setTestsOpen] = useState(false)

  const load = useCallback(async () => {
    setQueue(null)
    try {
      const [open, classified] = await Promise.all([
        api<InvoiceList>('invoices', { query: { unclassified: 1, store: currentStore, per_page: 1000, sort: 'paid_desc' } }),
        // Already classified invoices teach the suggestions which services usually make up an amount.
        api<InvoiceList>('invoices', { query: { store: currentStore, per_page: 1000, sort: 'added_desc' } }),
      ])
      setQueue(open.invoices)
      setTotal(open.total)
      setHistory(buildHistory(classified.invoices))
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
  const usable = useMemo(
    () => (inv ? items.filter((i) => i.is_active && (i.store_id === null || i.store_id === inv.store_id)) : []),
    [items, inv],
  )

  /** Services grouped by category in catalog order, most used first. */
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = usable.filter((i) => !term || i.name.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term))
    const byCat = new Map<number | null, CatalogItem[]>()
    for (const i of list) byCat.set(i.category_id, [...(byCat.get(i.category_id) ?? []), i])
    const ordered = [...categories].sort((a, b) => a.sort - b.sort || a.id - b.id)
    const out = ordered.filter((c) => byCat.has(c.id)).map((c) => ({ key: String(c.id), name: c.name, color: c.color, items: byCat.get(c.id)! }))
    if (byCat.has(null)) out.push({ key: 'none', name: 'بدون تصنيف', color: '#64748b', items: byCat.get(null)! })
    for (const g of out) g.items.sort((a, b) => b.usage_count - a.usage_count || (a.default_price ?? 0) - (b.default_price ?? 0))
    return out
  }, [usable, categories, q])

  const suggestions = useMemo(() => (inv ? suggest(inv.amount, usable, history) : []), [inv, usable, history])
  const testsInQueue = useMemo(() => (queue ?? []).filter((x) => x.amount <= TEST_MAX_AMOUNT).length, [queue])

  const setAndSplit = (next: Line[]) => inv && setLines(split(next, inv.amount, priceOf))
  const fromPicks = (picks: PickLine[]) => picks.map((p) => ({ item_id: p.item_id, qty: p.qty, price: 0, manual: false }))

  const toggle = (id: number) => {
    const has = lines.some((l) => l.item_id === id)
    setAndSplit(has ? lines.filter((l) => l.item_id !== id) : [...lines, { item_id: id, qty: 1, price: 0, manual: false }])
  }

  /** Quantity changes keep a single line's total (500 for 1 post → 500 for 5 posts at 100); several lines re-split. */
  const setQty = (id: number, qty: number) => {
    if (qty < 1 || qty > 999) return
    setAndSplit(lines.map((l) => (l.item_id === id ? { ...l, qty } : l)))
  }

  const editPrice = (id: number, value: string) => {
    const n = parseFloat(value.replace(/[^\d.]/g, ''))
    setAndSplit(lines.map((l) => (l.item_id === id ? { ...l, price: isNaN(n) ? 0 : cents(n), manual: true } : l)))
  }

  const applySuggestion = (s: Suggestion) => setAndSplit(fromPicks(s.lines))
  const resetSplit = () => setAndSplit(lines.map((l) => ({ ...l, manual: false })))
  const repeatLast = () => setAndSplit(fromPicks(last.filter((p) => usable.some((i) => i.id === p.item_id))))

  const sum = cents(lines.reduce((s, l) => s + l.price, 0))
  const remaining = inv ? cents(inv.amount - sum) : 0
  const canSave = !!inv && lines.length > 0 && Math.abs(remaining) < 0.01 && !saving

  const dropFromQueue = (ids: number[]) => {
    setQueue((qq) => (qq ? qq.filter((x) => !ids.includes(x.id)) : qq))
    setTotal((t) => Math.max(0, t - ids.length))
  }

  const save = useCallback(async () => {
    if (!inv || !canSave) return
    setSaving(true)
    try {
      const body = { items: lines.map((l) => ({ item_id: l.item_id, qty: l.qty, unit_price: cents(l.price / l.qty) })) }
      await api(`invoices/${inv.id}`, { method: 'PUT', body })
      const picks = lines.map((l) => ({ item_id: l.item_id, qty: l.qty }))
      setLast(picks)
      setHistory((h) => {
        addToHistory(h, inv.amount, picks)
        return new Map(h)
      })
      setDone((d) => d + 1)
      dropFromQueue([inv.id]) // the next invoice slides into the same position
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }, [inv, canSave, lines, toast])

  const removeAsTest = async (ids: number[]) => {
    for (let i = 0; i < ids.length; i += 1000) {
      await api('invoices/bulk', { method: 'POST', body: { ids: ids.slice(i, i + 1000), action: 'remove_test' } })
    }
    dropFromQueue(ids)
  }

  const markCurrentTest = async () => {
    if (!inv) return
    const ok = await confirm({
      title: 'إزالة كعملية تجريبية؟',
      text: `${inv.customer_name || 'بدون اسم'} · ${money(inv.amount)} ر.س. تُحذف من الفواتير والتصدير، ولا تعود عند استيراد نفس الملف مرة أخرى.`,
      confirmLabel: 'إزالة',
      danger: true,
    })
    if (!ok) return
    try {
      await removeAsTest([inv.id])
      toast('أُزيلت العملية التجريبية')
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

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
  const name = (id: number) => itemById.get(id)?.name ?? '—'
  const label = (s: Suggestion) => s.lines.map((l) => (l.qty > 1 ? `${l.qty} × ${name(l.item_id)}` : name(l.item_id))).join(' + ')
  /** Unit price implied by an "N ×" suggestion, when it differs from the catalog price. */
  const unitNote = (s: Suggestion) => (s.unit && s.unit !== priceOf(s.lines[0].item_id) ? `${money(s.unit)} للواحد` : null)
  const testsSheet = <RemoveTestsSheet open={testsOpen} onClose={() => setTestsOpen(false)} storeId={currentStore} onRemove={removeAsTest} />

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
        {testsSheet}
      </>
    )
  }

  const store = storeById(inv.store_id)
  const looksTest = inv.amount <= TEST_MAX_AMOUNT

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

        {testsInQueue > 0 && (
          <button onClick={() => setTestsOpen(true)} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-start text-warn">
            <FlaskConical className="size-5 shrink-0" />
            <span className="flex-1 text-[14px]">
              <span className="num font-bold">{testsInQueue}</span> عملية بمبلغ {TEST_MAX_AMOUNT} ر.س أو أقل، غالباً تجريبية
            </span>
            <span className="text-[14px] font-semibold">إزالتها</span>
          </button>
        )}

        {/* The invoice */}
        <Card className={cx('mb-4', looksTest && 'border-warn/50')}>
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
          {looksTest && (
            <button onClick={markCurrentTest} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-warn-soft py-2.5 text-[14px] font-semibold text-warn">
              <FlaskConical className="size-4" /> مبلغ صغير: إزالتها كعملية تجريبية
            </button>
          )}
        </Card>

        {/* Smart suggestions */}
        {(suggestions.length > 0 || last.length > 0) && (
          <div className="mb-3">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted">
              <Sparkles className="size-4 text-primary" /> اقتراحات لمبلغ {money(inv.amount)} ر.س
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.key}
                  onClick={() => applySuggestion(s)}
                  className="flex max-w-full items-center gap-1.5 rounded-2xl border border-primary/30 bg-primary-soft px-3 py-2 text-start text-[14px] font-medium text-primary active:scale-[0.98]"
                >
                  {s.kind === 'history' ? <HistoryIcon className="size-4 shrink-0" /> : s.kind === 'popular' ? <TrendingUp className="size-4 shrink-0" /> : <Sparkles className="size-4 shrink-0" />}
                  <span className="min-w-0" dir="auto">
                    {label(s)}
                  </span>
                  {unitNote(s) && <span className="shrink-0 text-[12px] opacity-75">{unitNote(s)}</span>}
                  {s.kind === 'history' && <span className="num shrink-0 rounded-full bg-primary/15 px-1.5 text-[12px]">×{s.count}</span>}
                </button>
              ))}
              {last.length > 0 && (
                <button onClick={repeatLast} className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2 text-[14px] font-medium">
                  <Repeat className="size-4 text-primary" /> نفس السابقة
                </button>
              )}
            </div>
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
                  const line = lines.find((l) => l.item_id === i.id)
                  return (
                    <button
                      key={i.id}
                      onClick={() => toggle(i.id)}
                      className={cx('rounded-2xl border p-3 text-start transition active:scale-[0.98]', line ? 'border-primary bg-primary-soft ring-2 ring-primary/30' : 'border-line bg-surface')}
                    >
                      <span className="flex items-start gap-1.5">
                        <span className="min-w-0 flex-1 text-[14px] font-semibold leading-snug" dir="auto">
                          {i.name}
                        </span>
                        {line && (
                          <span className="num flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1 text-[12px] text-primary-fg">
                            {line.qty > 1 ? `×${line.qty}` : <Check className="size-3.5" />}
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
          <button onClick={() => setTestsOpen(true)} className="flex w-full items-center justify-center gap-2 py-2 text-[14px] text-muted">
            <FlaskConical className="size-4" /> إزالة العمليات التجريبية
          </button>
        </div>
        {/* Room for the action bar, which grows with the selected services. */}
        <div style={{ height: 120 + Math.min(lines.length, 4) * 50 }} />
      </Page>

      {/* Selection + actions, always visible */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgb(0_0_0/0.06)] backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          {lines.length > 0 ? (
            <div className="mb-3 max-h-52 space-y-1.5 overflow-y-auto">
              {lines.map((l) => (
                <div key={l.item_id} className="flex items-center gap-1.5">
                  <button aria-label="إزالة" onClick={() => toggle(l.item_id)} className="flex size-8 shrink-0 items-center justify-center rounded-full text-muted">
                    <X className="size-4" />
                  </button>
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium" dir="auto">
                    {name(l.item_id)}
                  </span>
                  <span className="flex shrink-0 items-center rounded-xl border border-line">
                    <button aria-label="أقل" onClick={() => setQty(l.item_id, l.qty - 1)} disabled={l.qty <= 1} className="flex size-9 items-center justify-center disabled:opacity-30">
                      <Minus className="size-4" />
                    </button>
                    <span className="num w-7 text-center text-[15px] font-semibold">{l.qty}</span>
                    <button aria-label="أكثر" onClick={() => setQty(l.item_id, l.qty + 1)} className="flex size-9 items-center justify-center">
                      <Plus className="size-4" />
                    </button>
                  </span>
                  <div className="w-24 shrink-0">
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
            <p className="mb-3 text-center text-[14px] text-muted">اختر اقتراحاً أو خدمة أو أكثر، والمبلغ يتوزع تلقائياً</p>
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
              setAndSplit([...lines, { item_id: item.id, qty: 1, price: 0, manual: false }])
            }}
          />
        )}
      </Sheet>
      {testsSheet}
    </>
  )
}

/** Lists payments at or under a threshold (all of them, classified or not) and removes them as tests. */
function RemoveTestsSheet({ open, onClose, storeId, onRemove }: { open: boolean; onClose: () => void; storeId: number | null; onRemove: (ids: number[]) => Promise<void> }) {
  const { toast } = useFeedback()
  const [max, setMax] = useState(String(TEST_MAX_AMOUNT))
  const [list, setList] = useState<Invoice[] | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open) return
    const n = parseFloat(max)
    if (!(n > 0)) return setList([])
    setList(null)
    const t = setTimeout(async () => {
      try {
        setList((await api<InvoiceList>('invoices', { query: { store: storeId, max: n, per_page: 1000, sort: 'amount_asc' } })).invoices)
      } catch (e) {
        toast(errorMessage(e), 'error')
        setList([])
      }
    }, 250)
    return () => clearTimeout(t)
  }, [open, max, storeId, toast])

  const remove = async () => {
    if (!list?.length) return
    setBusy(true)
    try {
      await onRemove(list.map((i) => i.id))
      toast(`أُزيلت ${list.length} عملية تجريبية`)
      onClose()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(false)
    }
  }

  const sum = (list ?? []).reduce((s, i) => s + i.amount, 0)
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="إزالة العمليات التجريبية"
      footer={
        <Button block size="lg" variant="danger" icon={<Trash2 className="size-5" />} loading={busy} disabled={!list?.length} onClick={remove}>
          {list?.length ? `إزالة ${list.length} عملية` : 'لا توجد عمليات'}
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="العمليات بمبلغ أقل من أو يساوي (ر.س)" hint="تُحذف من الفواتير والتقارير والتصدير، ولا تعود عند استيراد نفس الملف مرة أخرى.">
          <Input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} dir="ltr" className="num" />
        </Field>
        {list === null ? (
          <PageLoader />
        ) : list.length ? (
          <>
            <p className="px-1 text-[14px] text-muted">
              <span className="num font-semibold text-fg">{list.length}</span> عملية · المجموع <span className="num font-semibold text-fg">{money(sum)}</span> ر.س
            </p>
            <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line">
              {list.slice(0, 200).map((i) => (
                <div key={i.id} className="flex items-center gap-3 px-3 py-2.5 text-[14px]">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium" dir="auto">
                      {i.customer_name || 'بدون اسم'}
                    </span>
                    <span className="text-[12px] text-muted">
                      {i.store_name} · {fmtDateTime(i.paid_at)}
                      {i.lines.length > 0 && ' · مصنّفة'}
                    </span>
                  </span>
                  <span className="num font-semibold">{money(i.amount)}</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <p className="py-6 text-center text-[15px] text-muted">لا توجد عمليات بهذا المبلغ أو أقل</p>
        )}
      </div>
    </Sheet>
  )
}
