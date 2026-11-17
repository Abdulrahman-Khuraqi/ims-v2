import { useEffect, useState, type ReactNode } from 'react'
import { CheckCircle2, FileSpreadsheet, FileText, TriangleAlert } from 'lucide-react'
import { api, errorMessage } from '../api'
import { useApp } from '../context'
import { useFeedback } from './Feedback'
import { Sheet } from './Sheet'
import { Button, Spinner, cx } from './ui'
import { ymd } from '../lib/format'
import { PROBLEM_LABELS, invoiceProblem, type InvoiceProblem } from '../lib/invoiceCheck'
import { loadInvoiceSettings } from '../lib/invoiceSettings'
import type { Invoice, InvoiceList, InvoiceSettings } from '../types'

type Query = Record<string, string | number | boolean | null | undefined>

/** A PDF page is an image of ~200 KB, so very large exports are split by period instead. */
const PDF_LIMIT = 500

async function fetchAll(query: Query): Promise<Invoice[]> {
  const all: Invoice[] = []
  for (let page = 1; ; page++) {
    const r = await api<InvoiceList>('invoices', { query: { ...query, page, per_page: 1000 } })
    all.push(...r.invoices)
    if (!r.invoices.length || all.length >= r.total) return all
  }
}

interface PdfPlan {
  ready: Invoice[]
  skipped: Partial<Record<InvoiceProblem, number>>
  settings: InvoiceSettings[]
}

/** Export choice: Excel (every invoice in the current filter) or one PDF of the complete invoices. */
export function ExportSheet({ open, onClose, query, total }: { open: boolean; onClose: () => void; query: Query; total?: number }) {
  const { storeById } = useApp()
  const { toast } = useFeedback()
  const [mode, setMode] = useState<null | 'pdf'>(null)
  const [busy, setBusy] = useState<null | 'excel' | 'plan' | 'pdf'>(null)
  const [plan, setPlan] = useState<PdfPlan | null>(null)
  const [progress, setProgress] = useState(0)
  const storeName = storeById(typeof query.store === 'number' ? query.store : null)?.name
  const baseName = `فواتير${storeName ? '-' + storeName : ''}-${ymd(new Date())}`

  useEffect(() => {
    if (!open) {
      setMode(null)
      setPlan(null)
      setProgress(0)
    }
  }, [open])

  const excel = async () => {
    setBusy('excel')
    try {
      const all = await fetchAll(query)
      const { exportInvoices } = await import('../lib/excel')
      exportInvoices(all, `${baseName}.xlsx`)
      onClose()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const preparePdf = async () => {
    setMode('pdf')
    setBusy('plan')
    try {
      const [all, settings] = await Promise.all([fetchAll(query), loadInvoiceSettings()])
      const ready: Invoice[] = []
      const skipped: PdfPlan['skipped'] = {}
      for (const inv of all) {
        const p = invoiceProblem(inv)
        if (p) skipped[p] = (skipped[p] ?? 0) + 1
        else ready.push(inv)
      }
      setPlan({ ready, skipped, settings })
    } catch (e) {
      toast(errorMessage(e), 'error')
      setMode(null)
    } finally {
      setBusy(null)
    }
  }

  const pdf = async () => {
    if (!plan?.ready.length) return
    setBusy('pdf')
    setProgress(0)
    try {
      const { exportInvoicesPdf } = await import('../lib/pdf')
      // Latin file name: some browsers drop non-Latin names for generated downloads.
      const slug = storeName && /^[\w .-]+$/.test(storeName) ? `-${storeName.trim().replace(/\s+/g, '-')}` : ''
      await exportInvoicesPdf(plan.ready, plan.settings, `invoices${slug}-${ymd(new Date())}.pdf`, (done) => setProgress(done))
      toast(`تم تصدير ${plan.ready.length} فاتورة PDF`)
      onClose()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setBusy(null)
    }
  }

  const skippedTotal = plan ? Object.values(plan.skipped).reduce((a, b) => a + (b ?? 0), 0) : 0
  const tooMany = (plan?.ready.length ?? 0) > PDF_LIMIT

  return (
    <Sheet
      open={open}
      onClose={busy === 'pdf' ? () => undefined : onClose}
      title="تصدير الفواتير"
      footer={
        mode === 'pdf' && plan ? (
          <Button block size="lg" loading={busy === 'pdf'} disabled={!plan.ready.length || tooMany || !!busy} onClick={pdf}>
            {busy === 'pdf' ? `جاري الإنشاء ${progress} / ${plan.ready.length}` : `تصدير ${plan.ready.length} فاتورة PDF`}
          </Button>
        ) : undefined
      }
    >
      {mode === null && (
        <div className="space-y-3">
          {total !== undefined && (
            <p className="px-1 text-[14px] text-muted">
              حسب الفلاتر الحالية: <span className="num font-semibold text-fg">{total}</span> فاتورة
            </p>
          )}
          <Choice
            icon={<FileSpreadsheet className="size-6" />}
            title="ملف Excel"
            text="كل الفواتير في الفلتر الحالي مع كل التفاصيل."
            loading={busy === 'excel'}
            disabled={!!busy || total === 0}
            onClick={excel}
          />
          <Choice
            icon={<FileText className="size-6" />}
            title="ملف PDF للفواتير المكتملة"
            text="كل فاتورة في صفحة بتصميم متجرها وشعاره. تُستبعد الفواتير غير المصنّفة أو التي فيها مشكلة."
            disabled={!!busy || total === 0}
            onClick={preparePdf}
          />
        </div>
      )}

      {mode === 'pdf' && busy === 'plan' && (
        <div className="flex flex-col items-center gap-3 py-10 text-muted">
          <Spinner className="size-7" />
          <p className="text-[15px]">جاري فحص الفواتير…</p>
        </div>
      )}

      {mode === 'pdf' && plan && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-3xl bg-success-soft p-4 text-success">
            <CheckCircle2 className="size-7 shrink-0" />
            <div>
              <p className="text-[17px] font-bold">
                <span className="num">{plan.ready.length}</span> فاتورة مكتملة
              </p>
              <p className="text-[14px] opacity-90">ستُصدَّر في ملف PDF واحد، صفحة لكل فاتورة.</p>
            </div>
          </div>
          {skippedTotal > 0 && (
            <div className="rounded-3xl bg-warn-soft p-4 text-warn">
              <p className="flex items-center gap-2 text-[16px] font-bold">
                <TriangleAlert className="size-5" /> <span className="num">{skippedTotal}</span> فاتورة مستبعدة
              </p>
              <ul className="mt-1.5 space-y-0.5 text-[14px]">
                {(Object.keys(plan.skipped) as InvoiceProblem[]).map((k) => (
                  <li key={k}>
                    • {PROBLEM_LABELS[k]}: <span className="num font-semibold">{plan.skipped[k]}</span>
                  </li>
                ))}
              </ul>
              {plan.skipped.unclassified ? <p className="mt-2 text-[13px] opacity-90">صنّف هذه الفواتير من «التصنيف السريع» ثم صدّرها.</p> : null}
              {plan.skipped.test ? <p className="mt-1 text-[13px] opacity-90">العمليات التجريبية تقدر تحذفها نهائياً من «التصنيف السريع» ← إزالة العمليات التجريبية.</p> : null}
            </div>
          )}
          {tooMany && (
            <p className="rounded-2xl bg-danger-soft p-3 text-[14px] text-danger">
              العدد كبير على ملف واحد. اختر فترة أقصر (حتى <span className="num">{PDF_LIMIT}</span> فاتورة) ثم صدّر.
            </p>
          )}
          {busy === 'pdf' && (
            <div className="h-2 overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${(progress / plan.ready.length) * 100}%` }} />
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}

function Choice({ icon, title, text, onClick, disabled, loading }: { icon: ReactNode; title: string; text: string; onClick: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cx('flex w-full items-center gap-4 rounded-3xl border border-line bg-surface p-4 text-start transition active:scale-[0.99]', disabled && 'opacity-60')}
    >
      <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primary-soft text-primary">{loading ? <Spinner className="size-5" /> : icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-semibold">{title}</span>
        <span className="block text-[14px] text-muted">{text}</span>
      </span>
    </button>
  )
}
