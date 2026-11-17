import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import type { Invoice, InvoiceSettings } from '../types'
import { parseDate, payLabel } from '../lib/format'
import './invoice-paper.css'

/**
 * The invoice paper from the original project (site-dev: InvoicePaper + invoice-paper.css):
 * English, left-to-right, A4. Company name, logo, stamp, colour and contact lines come from
 * the store's invoice template (Settings → قوالب الفواتير) instead of being hard-coded.
 */
export const A4_WIDTH = 794
export const A4_HEIGHT = 1123

const CURRENCY = 'SAR'
const pad = (n: number) => String(n).padStart(2, '0')
const cents = (n: number) => Math.round(n * 100) / 100

/** "2026-10-12 20:59:11" → "12/10/2026" */
function paperDate(s: string | null | undefined) {
  const d = parseDate(s)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}` : '—'
}

/** "2026-11-14 19:35:00" → "14/11/2026, 19:35" */
function paperDateTime(s: string | null | undefined) {
  const d = parseDate(s)
  return d ? `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—'
}

/** Payment methods in English for the paper ("Mada" → "mada", "ApplePay" → "Apple Pay"). */
const PAY_EN: Record<string, string> = { Card: 'Card', Mada: 'mada', ApplePay: 'Apple Pay', SamsungPay: 'Samsung Pay', Cash: 'Cash', Transfer: 'Bank transfer', Other: 'Other' }

const FAILED = /fail|declin|cancel|refund|revers|reject|void|error/i

/** 1500 → "1500.00" (no thousands separator, like the original invoices). */
const paperMoney = (n: number) => n.toFixed(2)

interface PaperRow {
  description: string
  note: string | null
  unitPrice: number
  qty: number
  amount: number
}

/** The amount paid is always the Total; lines adding up to more show the difference as a Discount. */
function buildPaperData(invoice: Invoice) {
  const rows: PaperRow[] = invoice.lines.length
    ? invoice.lines.map((l) => ({ description: l.name, note: l.line_note || l.description || null, unitPrice: l.unit_price, qty: l.qty, amount: cents(l.unit_price * l.qty) }))
    : [{ description: 'Purchase', note: null, unitPrice: invoice.amount, qty: 1, amount: invoice.amount }]
  const linesSum = cents(rows.reduce((s, r) => s + r.amount, 0))
  const total = cents(invoice.amount)
  // Per-unit rounding of a single line can drift by a cent or two; that isn't a discount.
  const subTotal = linesSum - total < 0.02 ? total : linesSum
  return {
    // Imported payments have no invoice number; their order reference (e.g. DXL261114-JTJDTV) is the customer-facing one.
    number: invoice.invoice_no || invoice.reference_no || `#${invoice.id}`,
    date: paperDate(invoice.paid_at ?? invoice.created_at_src ?? invoice.created_at),
    customer: invoice.customer_name || '—',
    email: invoice.email || '—',
    rows,
    subTotal,
    discount: cents(subTotal - total),
    total,
  }
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="ip-field">
      <span className="ip-field-label">{label}</span>
      <span className="ip-field-value" dir="auto">
        {value}
      </span>
    </div>
  )
}

export function InvoiceDocument({ invoice, settings }: { invoice: Invoice; settings?: InvoiceSettings }) {
  const d = buildPaperData(invoice)
  const brand = invoice.store_name
  const company = settings?.legal_name || brand
  const color = settings?.accent_color || invoice.store_color || '#0f2942'
  const vatRate = settings?.vat_rate ?? 0
  const vat = vatRate > 0 ? cents(d.total - d.total / (1 + vatRate / 100)) : 0
  const website = settings?.website?.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  const lines = [
    settings?.email,
    settings?.phone && `Phone: ${settings.phone}`,
    website,
    settings?.address,
    settings?.tax_number && `VAT No: ${settings.tax_number}`,
    settings?.cr_number && `CR No: ${settings.cr_number}`,
    settings?.freelance_no && `Freelance Document: ${settings.freelance_no}`,
  ].filter(Boolean) as string[]

  return (
    <div className="ip" style={{ '--ip-primary': color, '--ip-logo-h': '38px', '--ip-seal-w': '210px' } as CSSProperties}>
      <header>
        <div className="ip-brand">{brand}</div>
        <div className="ip-head-row">
          <h1 className="ip-title">{vatRate > 0 ? 'TAX INVOICE' : 'PURCHASE INVOICE'}</h1>
          {settings?.logo && <img src={settings.logo} alt={brand} className="ip-logo" />}
        </div>
        <div className="ip-rule" />
      </header>

      <section className="ip-parties">
        <div className="ip-block">
          <div className="ip-meta">
            <div className="ip-meta-item">
              <span className="ip-meta-label">Invoice Number:</span>
              <span className="ip-meta-value ip-num">{d.number}</span>
            </div>
            <div className="ip-meta-item">
              <span className="ip-meta-label">Invoice Date:</span>
              <span className="ip-meta-value ip-num">{d.date}</span>
            </div>
          </div>
          <h3 dir="auto">{company}</h3>
          {lines.map((line) => (
            <div key={line} className="ip-company-info" dir="auto">
              {line}
            </div>
          ))}
        </div>
        <div className="ip-block">
          <h3>Bill To</h3>
          <Field label="Customer Name" value={d.customer} />
          <Field label="Email" value={d.email} />
        </div>
      </section>

      <table className="ip-table">
        <thead>
          <tr>
            <th className="ip-col-desc">Item &amp; Description</th>
            <th className="ip-col-price">Unit Price</th>
            <th className="ip-col-qty">Qty</th>
            <th className="ip-col-amount">Amount</th>
          </tr>
        </thead>
        <tbody>
          {d.rows.map((r, i) => (
            <tr key={i}>
              <td className="ip-col-desc">
                <div dir="auto">{r.description}</div>
                {r.note && (
                  <div className="ip-item-note" dir="auto">
                    {r.note}
                  </div>
                )}
              </td>
              <td className="ip-col-price ip-num">
                {paperMoney(r.unitPrice)} {CURRENCY}
              </td>
              <td className="ip-col-qty ip-num">{r.qty}</td>
              <td className="ip-col-amount ip-num">
                {paperMoney(r.amount)} {CURRENCY}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <table className="ip-totals">
        <tbody>
          <tr>
            <td>Sub-Total</td>
            <td className="ip-num">
              {paperMoney(d.subTotal)} {CURRENCY}
            </td>
          </tr>
          <tr>
            <td>Discount</td>
            <td className="ip-num">
              {paperMoney(d.discount)} {CURRENCY}
            </td>
          </tr>
          {vatRate > 0 && (
            <tr>
              <td>VAT {vatRate}% (incl.)</td>
              <td className="ip-num">
                {paperMoney(vat)} {CURRENCY}
              </td>
            </tr>
          )}
          <tr className="ip-total-row">
            <td>Total</td>
            <td className="ip-num">
              {paperMoney(d.total)} {CURRENCY}
            </td>
          </tr>
        </tbody>
      </table>

      <PaymentAndNotes invoice={invoice} settings={settings} company={company} brand={brand} vatRate={vatRate} total={d.total} />

      <footer className="ip-footer">{settings?.seal && <img src={settings.seal} alt={`Company Seal - ${company}`} className="ip-seal" />}</footer>

      <div className="ip-closing">
        This is a computer-generated invoice. Thank you for choosing {brand}
        {website ? ` · ${website}` : ''}
      </div>
    </div>
  )
}

/** The A4 paper shrunk to the width of its container (a phone shows a small but exact page). */
export function PaperPreview({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.45)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(() => setScale(el.clientWidth / A4_WIDTH))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return (
    // dir=ltr: the paper is English; in the RTL app it would otherwise overflow to the left of its box.
    <div ref={ref} dir="ltr" className="overflow-hidden rounded-2xl border border-line bg-white shadow-card" style={{ height: A4_HEIGHT * scale }}>
      <div style={{ width: A4_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{children}</div>
    </div>
  )
}

/**
 * Payment details exactly as recorded (imported from the store's payment page or entered in the app),
 * and the standard notes printed on every invoice.
 */
function PaymentAndNotes({
  invoice, settings, company, brand, vatRate, total,
}: {
  invoice: Invoice
  settings?: InvoiceSettings
  company: string
  brand: string
  vatRate: number
  total: number
}) {
  const website = settings?.website?.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/\/$/, '')
  const paid = !FAILED.test(invoice.status ?? '')
  const method = invoice.pay_method ? PAY_EN[invoice.pay_method] ?? payLabel(invoice.pay_method) : null
  // "Card (Visa •••• 1234)", "mada •••• 5678": the brand only when it adds something to the method.
  const brand2 = invoice.card_type && invoice.card_type.toLowerCase() !== (method ?? '').toLowerCase() ? invoice.card_type : null
  const card = [brand2, invoice.card_last4 ? `•••• ${invoice.card_last4}` : null].filter(Boolean).join(' ')
  const txn = invoice.transaction_id && !invoice.transaction_id.startsWith('tpl-') && invoice.transaction_id !== invoice.reference_no ? invoice.transaction_id : null
  const online = invoice.source === 'import'
  const contact = [settings?.email, settings?.phone].filter(Boolean).join(' or ')

  const rows: [string, ReactNode][] = [
    ['Payment Status', paid ? <span className="ip-paid">PAID</span> : invoice.status],
    ['Amount Paid', `${total.toFixed(2)} SAR`],
  ]
  if (method || card) rows.push(['Payment Method', [method, card && (brand2 ? `(${card})` : card)].filter(Boolean).join(' ')])
  rows.push(['Payment Date', paperDateTime(invoice.paid_at ?? invoice.created_at)])
  if (invoice.reference_no) rows.push(['Payment Reference', invoice.reference_no])
  if (txn) rows.push(['Transaction ID', <span className="ip-break">{txn}</span>])
  if (invoice.auth_code) rows.push(['Authorisation Code', invoice.auth_code])
  rows.push(['Payment Channel', online ? `Online checkout${website ? ` on ${website}` : ''}` : `Recorded by ${brand}`])

  const notes = [
    paid && 'This invoice is issued for a payment received in full. No further amount is due.',
    online
      ? `The payment details above are taken directly from the payment record of the secure online checkout${website ? ` on ${website}` : ''}.`
      : `The payment details above are as recorded by ${company}.`,
    'The services listed describe the work covered by this payment. Final deliverables, timelines and revisions follow the scope agreed with the client.',
    `All amounts are in Saudi Riyals (SAR).${vatRate > 0 ? ` Prices include VAT at ${vatRate}%.` : ''}`,
    website && `Cancellation and refund terms are published on ${website}.`,
    contact && `For any questions about this invoice, please contact ${contact}.`,
  ].filter(Boolean) as string[]

  return (
    <section className="ip-info">
      <div>
        <h3>Payment Details</h3>
        <table className="ip-pay">
          <tbody>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td>{k}</td>
                <td className="ip-num">{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <h3>Notes</h3>
        <ol className="ip-notes">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ol>
      </div>
    </section>
  )
}
