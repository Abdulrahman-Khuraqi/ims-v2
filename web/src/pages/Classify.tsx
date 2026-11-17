import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Check, ChevronDown, ChevronLeft, ChevronRight, FlaskConical, History as HistoryIcon, Layers, Minus, Pencil, Plus, Repeat, Search,
  Sparkles, Trash2, TrendingUp, Wand2, X,
} from 'lucide-react'
import { api, errorMessage } from '../api'
import { useApp } from '../context'
import { useFeedback } from '../components/Feedback'
import { NewItemForm } from '../components/ItemPicker'
import { Page, TopBar } from '../components/Layout'
import { Sheet } from '../components/Sheet'
import { Button, Card, EmptyState, Field, Input, Money, PageLoader, Segmented, StoreDot, cx } from '../components/ui'
import { fmtDateTime, money } from '../lib/format'
import { TEST_MAX_AMOUNT } from '../lib/invoiceCheck'
import { addToHistory, buildHistory, suggest, type History, type PickLine, type Suggestion } from '../lib/suggest'
import type { CatalogItem, Invoice, InvoiceList } from '../types'

/**
 * One selected service. `price` is the line total. `manual` lines keep their total (typed, copied or loaded);
 * the others share what is left. `typed` = the user entered this total, so it never moves by itself.
 */
interface Line {
  item_id: number
  qty: number
  price: number
  manual: boolean
  typed?: boolean
}

type Mode = 'groups' | 'one' | 'review'

/** What is being classified: one invoice, or every chosen invoice of one amount in one store. */
interface Target {
  kind: 'invoice' | 'group'
  key: string
  amount: number
  store_id: number
  invoices: Invoice[]
  /** review: an already classified invoice being corrected */
  editing?: boolean
}

const cents = (n: number) => Math.round(n * 100) / 100

/**
 * Splits the amount: fixed lines keep their totals, the rest is shared by the other lines in proportion
 * to catalog price × quantity (by quantity when a price is missing), in whole riyals when possible.
 */
function split(lines: Line[], amount: number, priceOf: (id: number) => number | null): Line[] {
  const auto = lines.filter((l) => !l.manual)
  if (!auto.length) return lines
  const rest = Math.max(0, cents(amount - lines.filter((l) => l.manual).reduce((s, l) => s + l.price, 0)))
  const prices = auto.map((l) => priceOf(l.item_id))
  const w = prices.every((p) => p && p > 0) ? auto.map((l, i) => prices[i]! * l.qty) : auto.map((l) => l.qty)
  return distribute(lines, auto, rest, w)
}

function distribute(lines: Line[], targets: Line[], amount: number, weights: number[]): Line[] {
  const total = weights.reduce((a, b) => a + b, 0) || 1
  const round = Number.isInteger(amount) ? Math.round : cents
  let given = 0
  const out = targets.map((_, i) => {
    if (i === targets.length - 1) return cents(amount - given)
    const p = round((amount * weights[i]) / total)
    given = cents(given + p)
    return p
  })
  const map = new Map(targets.map((t, i) => [t, out[i]]))
  return lines.map((l) => (map.has(l) ? { ...l, price: map.get(l)! } : l))
}

/** Copies an earlier split: the same totals for the same amount, the same proportions for another amount. */
function copySplit(prev: Line[], prevAmount: number, amount: number): Line[] {
  const fixed = prev.map((l) => ({ ...l, manual: true }))
  if (Math.abs(prevAmount - amount) < 0.01) return fixed
  return distribute(fixed, fixed, amount, fixed.map((l) => l.price || 1))
}

const linesOf = (inv: Invoice): Line[] => inv.lines.map((l) => ({ item_id: l.item_id, qty: l.qty, price: cents(l.qty * l.unit_price), manual: true }))

export default function Classify() {
  const { items, categories, currentStore, storeById, reloadCatalog } = useApp()
  const { toast, confirm } = useFeedback()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('groups')
  const [queue, setQueue] = useState<Invoice[] | null>(null)
  const [classified, setClassified] = useState<Invoice[]>([])
  const [index, setIndex] = useState(0)
  const [group, setGroup] = useState<Target | null>(null)
  const [excluded, setExcluded] = useState<Set<number>>(new Set())
  const [showGroupList, setShowGroupList] = useState(false)
  const [editing, setEditing] = useState<Invoice | null>(null)
  const [lines, setLines] = useState<Line[]>([])
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(0)
  const [last, setLast] = useState<{ lines: Line[]; amount: number } | null>(null)
  const [history, setHistory] = useState<History>(new Map())
  const [creating, setCreating] = useState(false)
  const [testsOpen, setTestsOpen] = useState(false)

  const load = useCallback(async () => {
    setQueue(null)
    setGroup(null)
    setEditing(null)
    try {
      const [open, done] = await Promise.all([
        api<InvoiceList>('invoices', { query: { unclassified: 1, store: currentStore, per_page: 2000, sort: 'paid_desc' } }),
        api<InvoiceList>('invoices', { query: { classified: 1, store: currentStore, per_page: 2000, sort: 'updated_desc' } }),
      ])
      setQueue(open.invoices)
      setClassified(done.invoices)
      setHistory(buildHistory(done.invoices))
      setIndex(0)
    } catch (e) {
      toast(errorMessage(e), 'error')
      setQueue([])
    }
  }, [currentStore, toast])
  useEffect(() => {
    load()
  }, [load])

  /** Unclassified invoices grouped by store and amount, biggest groups first. */
  const groups = useMemo(() => {
    const m = new Map<string, Target>()
    for (const inv of queue ?? []) {
      if (inv.amount <= TEST_MAX_AMOUNT) continue
      const key = `${inv.store_id}:${inv.amount}`
      const g = m.get(key) ?? { kind: 'group' as const, key, amount: inv.amount, store_id: inv.store_id, invoices: [] }
      g.invoices.push(inv)
      m.set(key, g)
    }
    return [...m.values()].sort((a, b) => b.invoices.length - a.invoices.length || b.amount - a.amount)
  }, [queue])

  const target: Target | null = useMemo(() => {
    if (editing) return { kind: 'invoice', key: 'e' + editing.id, amount: editing.amount, store_id: editing.store_id, invoices: [editing], editing: true }
    if (mode === 'groups') return group
    const inv = queue?.[index]
    return inv && mode === 'one' ? { kind: 'invoice', key: 'i' + inv.id, amount: inv.amount, store_id: inv.store_id, invoices: [inv] } : null
  }, [editing, mode, group, queue, index])

  const itemById = useMemo(() => new Map(items.map((i) => [i.id, i])), [items])
  const priceOf = useCallback((id: number) => itemById.get(id)?.default_price ?? null, [itemById])
  const usableFor = useCallback((storeId: number) => items.filter((i) => i.is_active && (i.store_id === null || i.store_id === storeId)), [items])
  const usable = useMemo(() => (target ? usableFor(target.store_id) : []), [target, usableFor])
  const suggestions = useMemo(() => (target ? suggest(target.amount, usable, history) : []), [target, usable, history])
  const name = (id: number) => itemById.get(id)?.name ?? '—'
  const fromPicks = (picks: PickLine[]): Line[] => picks.map((p) => ({ item_id: p.item_id, qty: p.qty, price: 0, manual: false }))

  // New target: reviews load their saved lines; groups start from the best suggestion; single invoices start empty.
  useEffect(() => {
    setQ('')
    if (!target) return setLines([])
    if (target.editing) return setLines(linesOf(target.invoices[0]))
    if (target.kind === 'group') {
      const top = suggest(target.amount, usableFor(target.store_id), history)[0]
      return setLines(top ? split(fromPicks(top.lines), target.amount, priceOf) : [])
    }
    setLines([])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target?.key])

  const setAndSplit = (next: Line[]) => target && setLines(split(next, target.amount, priceOf))
  const toggle = (id: number) =>
    setAndSplit(lines.some((l) => l.item_id === id) ? lines.filter((l) => l.item_id !== id) : [...lines, { item_id: id, qty: 1, price: 0, manual: false }])
  /** A single line keeps its total when the quantity changes (500 for 1 → 500 for 5 at 100); several lines re-split. */
  const setQty = (id: number, qty: number) => {
    if (qty < 1 || qty > 999) return
    const next = lines.map((l) => (l.item_id === id ? { ...l, qty, manual: lines.length > 1 ? false : l.manual } : l))
    setAndSplit(next)
  }
  /** The typed line is fixed; lines the user has not typed (suggested, copied or loaded) take what is left. */
  const editPrice = (id: number, value: string) => {
    const n = parseFloat(value.replace(/[^\d.]/g, ''))
    setAndSplit(lines.map((l) => (l.item_id === id ? { ...l, price: isNaN(n) ? 0 : cents(n), manual: true, typed: true } : l.typed ? l : { ...l, manual: false })))
  }
  const applySuggestion = (s: Suggestion) => setAndSplit(fromPicks(s.lines))
  const resetSplit = () => setAndSplit(lines.map((l) => ({ ...l, manual: false, typed: false })))
  const repeatLast = () => {
    if (!last || !target) return
    const ok = last.lines.filter((l) => usable.some((i) => i.id === l.item_id))
    setLines(copySplit(ok, last.amount, target.amount))
  }

  const chosen = target ? target.invoices.filter((i) => !excluded.has(i.id)) : []
  const sum = cents(lines.reduce((s, l) => s + l.price, 0))
  const remaining = target ? cents(target.amount - sum) : 0
  const canSave = !!target && lines.length > 0 && chosen.length > 0 && Math.abs(remaining) < 0.01 && !saving

  const save = useCallback(async () => {
    if (!target || !canSave) return
    setSaving(true)
    const payload = lines.map((l) => ({ item_id: l.item_id, qty: l.qty, unit_price: cents(l.price / l.qty) }))
    try {
      let saved: Invoice[]
      if (target.kind === 'group') {
        await api('invoices/bulk', { method: 'POST', body: { ids: chosen.map((i) => i.id), action: 'set_lines', items: payload } })
        const fakeLines = payload.map((p) => ({ ...p, name: name(p.item_id), kind: 'service' as const, is_active: true, line_note: null, category_name: null, category_color: null }))
        saved = chosen.map((i) => ({ ...i, lines: fakeLines }))
      } else {
        const r = await api<{ invoice: Invoice }>(`invoices/${target.invoices[0].id}`, { method: 'PUT', body: { items: payload } })
        saved = [r.invoice]
      }
      const ids = new Set(saved.map((i) => i.id))
      const picks = lines.map((l) => ({ item_id: l.item_id, qty: l.qty }))
      if (!target.editing) {
        setHistory((h) => {
          for (let k = 0; k < saved.length; k++) addToHistory(h, target.amount, picks)
          return new Map(h)
        })
      }
      setLast({ lines: lines.map((l) => ({ ...l })), amount: target.amount })
      setQueue((qq) => (qq ? qq.filter((x) => !ids.has(x.id)) : qq))
      setClassified((c) => [...saved, ...c.filter((x) => !ids.has(x.id))])
      setDone((d) => d + (target.editing ? 0 : saved.length))
      if (target.kind === 'group') {
        toast(`صُنّفت ${saved.length} فاتورة`)
        setGroup(null)
        setExcluded(new Set())
      }
      if (target.editing) {
        toast('تم حفظ التعديل')
        setEditing(null)
      }
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, canSave, lines, chosen, toast])

  const skip = () => {
    if (target?.kind === 'invoice' && !target.editing) setIndex((i) => i + 1)
  }

  // Keyboard (desktop): 1–6 apply a suggestion, R = same as last, Enter = save, S = skip, Esc = back.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      const typing = el?.tagName === 'INPUT' || el?.tagName === 'TEXTAREA'
      if (e.key === 'Enter' && el?.getAttribute?.('type') !== 'search') {
        e.preventDefault()
        save()
      } else if (!typing && /^[1-6]$/.test(e.key) && suggestions[+e.key - 1]) {
        applySuggestion(suggestions[+e.key - 1])
      } else if (!typing && (e.key === 's' || e.key === 'س')) {
        skip()
      } else if (!typing && (e.key === 'r' || e.key === 'ق')) {
        repeatLast()
      } else if (e.key === 'Escape') {
        setGroup(null)
        setEditing(null)
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  })

  const removeAsTest = async (ids: number[]) => {
    for (let i = 0; i < ids.length; i += 1000) await api('invoices/bulk', { method: 'POST', body: { ids: ids.slice(i, i + 1000), action: 'remove_test' } })
    const gone = new Set(ids)
    setQueue((qq) => (qq ? qq.filter((x) => !gone.has(x.id)) : qq))
    setClassified((c) => c.filter((x) => !gone.has(x.id)))
  }
  const markCurrentTest = async (inv: Invoice) => {
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

  const testsInQueue = (queue ?? []).filter((x) => x.amount <= TEST_MAX_AMOUNT).length
  const label = (s: Suggestion) => s.lines.map((l) => (l.qty > 1 ? `${l.qty} × ${name(l.item_id)}` : name(l.item_id))).join(' + ')
  const unitNote = (s: Suggestion) => (s.unit && s.unit !== priceOf(s.lines[0].item_id) ? `${money(s.unit)} للواحد` : null)
  const testsSheet = <RemoveTestsSheet open={testsOpen} onClose={() => setTestsOpen(false)} storeId={currentStore} onRemove={removeAsTest} />

  const header = (
    <>
      <TopBar title="تصنيف سريع" back switcher />
    </>
  )

  if (!queue) {
    return (
      <>
        {header}
        <PageLoader />
      </>
    )
  }

  // ---------------------------------------------------------------- lists (no target open)
  if (!target) {
    const tabs = (
      <div className="mb-3">
        <Segmented
          value={mode}
          onChange={(m) => {
            setMode(m)
            setIndex(0)
          }}
          options={[
            { value: 'groups', label: <><Layers className="size-4" /> حسب المبلغ</> },
            { value: 'one', label: 'فاتورة فاتورة' },
            { value: 'review', label: <><Pencil className="size-4" /> مراجعة</> },
          ]}
        />
      </div>
    )
    const testsBanner = testsInQueue > 0 && (
      <button onClick={() => setTestsOpen(true)} className="mb-3 flex w-full items-center gap-3 rounded-2xl border border-warn/30 bg-warn-soft px-4 py-3 text-start text-warn">
        <FlaskConical className="size-5 shrink-0" />
        <span className="flex-1 text-[14px]">
          <span className="num font-bold">{testsInQueue}</span> عملية بمبلغ {TEST_MAX_AMOUNT} ر.س أو أقل، غالباً تجريبية
        </span>
        <span className="text-[14px] font-semibold">إزالتها</span>
      </button>
    )
    return (
      <>
        {header}
        <Page>
          {tabs}
          <p className="mb-3 px-1 text-[14px] text-muted">
            غير مصنّفة <span className="num font-semibold text-fg">{queue.length}</span>
            {done > 0 && (
              <>
                {' '}· صنّفت الآن <span className="num font-semibold text-success">{done}</span>
              </>
            )}
          </p>
          {testsBanner}

          {mode === 'groups' &&
            (groups.length ? (
              <div className="space-y-2">
                <p className="px-1 text-[13px] text-muted">الفواتير بنفس المبلغ تُصنّف مرة واحدة. افتح المجموعة، تأكد من الاقتراح، واحفظ للكل.</p>
                {groups.map((g) => {
                  const top = suggest(g.amount, usableFor(g.store_id), history)[0]
                  return (
                    <Card
                      key={g.key}
                      onClick={() => {
                        setExcluded(new Set())
                        setShowGroupList(false)
                        setGroup(g)
                      }}
                      className="flex items-center gap-3"
                    >
                      <span className="w-24 shrink-0">
                        <Money value={g.amount} className="block text-[19px] font-bold" />
                        <span className="flex items-center gap-1 text-[12px] text-muted">
                          <StoreDot color={storeById(g.store_id)?.color ?? '#999'} /> {storeById(g.store_id)?.name}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[15px] font-semibold">
                          <span className="num">{g.invoices.length}</span> فاتورة
                        </span>
                        {top && (
                          <span className="block truncate text-[13px] text-primary" dir="auto">
                            ✨ {label(top)}
                          </span>
                        )}
                      </span>
                      <ChevronLeft className="size-5 shrink-0 text-muted" />
                    </Card>
                  )
                })}
              </div>
            ) : (
              <EmptyState icon={<Check className="size-10" />} title="لا توجد فواتير غير مصنّفة" text="كل الفواتير مصنّفة." action={<Button variant="secondary" onClick={() => navigate('/invoices')}>الفواتير</Button>} />
            ))}

          {mode === 'one' &&
            (queue.length ? (
              <EmptyState
                icon={<Check className="size-10" />}
                title="وصلت لنهاية القائمة"
                text={`بقيت ${queue.length} فاتورة تخطيتها.`}
                action={<Button onClick={() => setIndex(0)}>ابدأ من أول فاتورة</Button>}
              />
            ) : (
              <EmptyState icon={<Check className="size-10" />} title="لا توجد فواتير غير مصنّفة" text="كل الفواتير مصنّفة." />
            ))}

          {mode === 'review' && (
            <div className="space-y-2">
              <p className="px-1 text-[13px] text-muted">آخر الفواتير المصنّفة أولاً. اضغط أي فاتورة لتعديل خدماتها ومبالغها.</p>
              {classified.slice(0, 300).map((inv) => (
                <Card key={inv.id} onClick={() => setEditing(inv)} className="flex items-start gap-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold" dir="auto">
                      {inv.customer_name || 'بدون اسم'}
                    </span>
                    <span className="block space-y-0.5 text-[13px] text-muted">
                      {inv.lines.map((l, li) => (
                        <span key={`${l.item_id}-${li}`} className="flex justify-between gap-2">
                          <span className="truncate" dir="auto">
                            {l.qty > 1 ? `${l.qty} × ` : ''}
                            {l.name}
                          </span>
                          <span className="num shrink-0">{money(l.qty * l.unit_price)}</span>
                        </span>
                      ))}
                    </span>
                  </span>
                  <Money value={inv.amount} className="shrink-0 text-[17px] font-bold" />
                </Card>
              ))}
              {!classified.length && <EmptyState icon={<Pencil className="size-10" />} title="لا توجد فواتير مصنّفة بعد" />}
            </div>
          )}
        </Page>
        {testsSheet}
      </>
    )
  }

  // ---------------------------------------------------------------- editor (one invoice, a group, or a review)
  const store = storeById(target.store_id)
  const single = target.kind === 'invoice' ? target.invoices[0] : null
  const looksTest = !!single && single.amount <= TEST_MAX_AMOUNT && !target.editing
  const saveLabel = target.kind === 'group' ? `حفظ لـ ${chosen.length} فاتورة` : target.editing ? 'حفظ التعديل' : 'حفظ والتالي'
  const back = () => {
    setGroup(null)
    setEditing(null)
    if (mode === 'one') setMode('groups')
  }

  return (
    <>
      {header}
      <Page>
        <div className="mb-3 flex items-center justify-between px-1 text-[14px] text-muted">
          <button onClick={back} className="flex items-center gap-1 font-semibold text-primary">
            <ChevronRight className="size-5" /> {target.kind === 'group' ? 'المجموعات' : target.editing ? 'المراجعة' : 'القوائم'}
          </button>
          {target.kind === 'invoice' && !target.editing && (
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
          )}
        </div>

        {/* What is being classified */}
        <Card className={cx('mb-4', looksTest && 'border-warn/50', target.editing && 'border-primary/40')}>
          {single ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-[18px] font-bold" dir="auto">
                    {single.customer_name || 'بدون اسم'}
                  </p>
                  {single.email && (
                    <p className="truncate text-[14px] text-muted" dir="ltr">
                      {single.email}
                    </p>
                  )}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                    <span className="flex items-center gap-1">
                      <StoreDot color={store?.color ?? single.store_color} /> {single.store_name}
                    </span>
                    <span>{fmtDateTime(single.paid_at)}</span>
                    {(single.reference_no || single.invoice_no) && <span className="num">{single.invoice_no || single.reference_no}</span>}
                  </p>
                </div>
                <Money value={single.amount} className="shrink-0 text-[26px] font-bold" />
              </div>
              {single.note && <p className="mt-2 rounded-xl bg-surface-2 px-3 py-2 text-[13px]">{single.note}</p>}
              {target.editing && <p className="mt-2 text-[13px] text-primary">تعديل فاتورة مصنّفة: المبالغ الحالية محفوظة كما هي حتى تغيّرها.</p>}
              {looksTest && (
                <button onClick={() => markCurrentTest(single)} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-warn-soft py-2.5 text-[14px] font-semibold text-warn">
                  <FlaskConical className="size-4" /> مبلغ صغير: إزالتها كعملية تجريبية
                </button>
              )}
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[18px] font-bold">
                    <span className="num">{chosen.length}</span> فاتورة بنفس المبلغ
                  </p>
                  <p className="flex items-center gap-1 text-[13px] text-muted">
                    <StoreDot color={store?.color ?? '#999'} /> {store?.name}
                  </p>
                </div>
                <Money value={target.amount} className="text-[26px] font-bold" />
              </div>
              <button onClick={() => setShowGroupList((v) => !v)} className="mt-2 flex items-center gap-1 text-[13px] font-semibold text-primary">
                <ChevronDown className={cx('size-4 transition', showGroupList && 'rotate-180')} /> {showGroupList ? 'إخفاء الفواتير' : 'عرض الفواتير واستثناء بعضها'}
              </button>
              {showGroupList && (
                <div className="mt-2 max-h-72 divide-y divide-line overflow-y-auto rounded-2xl border border-line">
                  {target.invoices.map((inv) => {
                    const on = !excluded.has(inv.id)
                    return (
                      <label key={inv.id} className="flex cursor-pointer items-center gap-3 px-3 py-2.5 text-[14px]">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() =>
                            setExcluded((x) => {
                              const n = new Set(x)
                              if (on) n.add(inv.id)
                              else n.delete(inv.id)
                              return n
                            })
                          }
                          className="size-5 accent-[var(--primary)]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium" dir="auto">
                            {inv.customer_name || 'بدون اسم'}
                          </span>
                          <span className="text-[12px] text-muted">{fmtDateTime(inv.paid_at)}</span>
                        </span>
                      </label>
                    )
                  })}
                </div>
              )}
            </>
          )}
        </Card>

        {/* Smart suggestions (keys 1–6) */}
        {(suggestions.length > 0 || last) && (
          <div className="mb-3">
            <p className="mb-1.5 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted">
              <Sparkles className="size-4 text-primary" /> اقتراحات لمبلغ {money(target.amount)} ر.س
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s, k) => (
                <button
                  key={s.key}
                  onClick={() => applySuggestion(s)}
                  className="flex max-w-full items-center gap-1.5 rounded-2xl border border-primary/30 bg-primary-soft px-3 py-2 text-start text-[14px] font-medium text-primary active:scale-[0.98]"
                >
                  <span className="num hidden size-5 shrink-0 items-center justify-center rounded-md bg-primary/15 text-[11px] md:flex">{k + 1}</span>
                  {s.kind === 'history' ? <HistoryIcon className="size-4 shrink-0" /> : s.kind === 'popular' ? <TrendingUp className="size-4 shrink-0" /> : <Sparkles className="size-4 shrink-0" />}
                  <span className="min-w-0" dir="auto">
                    {label(s)}
                  </span>
                  {unitNote(s) && <span className="shrink-0 text-[12px] opacity-75">{unitNote(s)}</span>}
                  {s.kind === 'history' && <span className="num shrink-0 rounded-full bg-primary/15 px-1.5 text-[12px]">×{s.count}</span>}
                </button>
              ))}
              {last && (
                <button onClick={repeatLast} className="flex items-center gap-1.5 rounded-2xl border border-line bg-surface px-3 py-2 text-[14px] font-medium">
                  <Repeat className="size-4 text-primary" /> نفس السابقة
                  {Math.abs(last.amount - target.amount) >= 0.01 && <span className="text-[12px] text-muted">(بنفس النسب)</span>}
                </button>
              )}
            </div>
          </div>
        )}

        <div className="relative mb-3">
          <Search className="pointer-events-none absolute start-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
          <Input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ابحث عن خدمة…" className="ps-12" enterKeyHint="search" />
        </div>

        <ServiceGrid items={usable} categories={categories} q={q} lines={lines} onToggle={toggle} />
        <div className="mt-4 space-y-2">
          <Button variant="soft" block icon={<Plus className="size-5" />} onClick={() => setCreating(true)}>
            خدمة جديدة
          </Button>
          <p className="hidden text-center text-[12px] text-muted md:block">اختصارات: 1–6 اقتراح · R نفس السابقة · Enter حفظ · S تخطي · Esc رجوع</p>
        </div>
        <div style={{ height: 130 + Math.min(lines.length, 4) * 50 }} />
      </Page>

      {/* Selection + actions */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_rgb(0_0_0/0.06)] backdrop-blur-md">
        <div className="mx-auto max-w-2xl">
          {lines.length > 0 ? (
            <div className="mb-3 max-h-52 space-y-1.5 overflow-y-auto">
              {lines.map((l, li) => (
                <div key={`${l.item_id}-${li}`} className="flex items-center gap-1.5">
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
                  <span className="text-success">المجموع يساوي المبلغ</span>
                ) : (
                  <span className="text-danger">
                    {remaining > 0 ? 'متبقي' : 'زيادة'} <span className="num font-semibold">{money(Math.abs(remaining))}</span> ر.س
                  </span>
                )}
                {lines.length > 1 && (
                  <button onClick={resetSplit} className="flex items-center gap-1 font-semibold text-primary">
                    <Wand2 className="size-4" /> وزّع حسب الأسعار
                  </button>
                )}
              </div>
            </div>
          ) : (
            <p className="mb-3 text-center text-[14px] text-muted">اختر اقتراحاً أو خدمة أو أكثر، والمبلغ يتوزع تلقائياً</p>
          )}
          <div className="flex gap-2">
            {target.kind === 'invoice' && !target.editing && (
              <Button variant="secondary" size="lg" onClick={skip}>
                تخطي
              </Button>
            )}
            {(target.kind === 'group' || target.editing) && (
              <Button variant="secondary" size="lg" onClick={back}>
                رجوع
              </Button>
            )}
            <Button block size="lg" loading={saving} disabled={!canSave} onClick={save}>
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="خدمة جديدة">
        {creating && (
          <NewItemForm
            defaultName={q}
            storeId={target.store_id}
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

/** Services grouped by category in catalog order, most used first. */
function ServiceGrid({
  items, categories, q, lines, onToggle,
}: {
  items: CatalogItem[]
  categories: { id: number; name: string; color: string; sort: number }[]
  q: string
  lines: Line[]
  onToggle: (id: number) => void
}) {
  const groups = useMemo(() => {
    const term = q.trim().toLowerCase()
    const list = items.filter((i) => !term || i.name.toLowerCase().includes(term) || (i.description ?? '').toLowerCase().includes(term))
    const byCat = new Map<number | null, CatalogItem[]>()
    for (const i of list) byCat.set(i.category_id, [...(byCat.get(i.category_id) ?? []), i])
    const ordered = [...categories].sort((a, b) => a.sort - b.sort || a.id - b.id)
    const out = ordered.filter((c) => byCat.has(c.id)).map((c) => ({ key: String(c.id), name: c.name, color: c.color, items: byCat.get(c.id)! }))
    if (byCat.has(null)) out.push({ key: 'none', name: 'بدون تصنيف', color: '#64748b', items: byCat.get(null)! })
    for (const g of out) g.items.sort((a, b) => b.usage_count - a.usage_count || (a.default_price ?? 0) - (b.default_price ?? 0))
    return out
  }, [items, categories, q])

  return (
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
                  onClick={() => onToggle(i.id)}
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
    </div>
  )
}

/** Lists payments at or under a threshold (classified or not) and removes them as tests. */
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
