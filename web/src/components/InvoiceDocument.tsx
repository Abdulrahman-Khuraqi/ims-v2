import type { CSSProperties, ReactNode } from 'react'
import type { Invoice, InvoiceSettings } from '../types'
import { fmtDate, fmtDateTime, money } from '../lib/format'

/** A4 at 96 dpi. The PDF export renders one of these per page. */
export const A4_WIDTH = 794
export const A4_HEIGHT = 1123

const INK = '#16181d'
const MUTED = '#6b7280'
const LINE = '#e5e7eb'
const SOFT = '#f6f7f9'
const FONT = "'IBM Plex Sans Arabic', system-ui, -apple-system, 'Segoe UI', Tahoma, sans-serif"

const ltr: CSSProperties = { direction: 'ltr', unicodeBidi: 'isolate', fontVariantNumeric: 'tabular-nums' }
const Num = ({ children, style }: { children: ReactNode; style?: CSSProperties }) => <span style={{ ...ltr, ...style }}>{children}</span>

function Label({ ar, en }: { ar: string; en: string }) {
  return (
    <div style={{ fontSize: 11, color: MUTED, marginBottom: 3, display: 'flex', gap: 6, alignItems: 'baseline' }}>
      <span style={{ fontWeight: 600 }}>{ar}</span>
      <span style={{ fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase' }}>{en}</span>
    </div>
  )
}

/** Printable invoice in the store's own branding (logo, accent colour, seller details). */
export function InvoiceDocument({ invoice, settings }: { invoice: Invoice; settings?: InvoiceSettings }) {
  const accent = settings?.accent_color || invoice.store_color || '#4f46e5'
  const seller = settings?.legal_name || invoice.store_name
  const vatRate = settings?.vat_rate ?? 0
  const total = invoice.amount
  const subtotal = vatRate > 0 ? total / (1 + vatRate / 100) : total
  const vat = total - subtotal
  const number = invoice.invoice_no || `INV-${String(invoice.id).padStart(5, '0')}`
  const website = settings?.website?.replace(/^https?:\/\//i, '').replace(/\/$/, '')
  const card = [invoice.card_type, invoice.card_last4 ? `•••• ${invoice.card_last4}` : null].filter(Boolean).join(' ')

  const sellerLines = [
    settings?.address,
    settings?.phone && <Num key="p">{settings.phone}</Num>,
    settings?.email && <Num key="e">{settings.email}</Num>,
    website && <Num key="w">{website}</Num>,
  ].filter(Boolean)

  const meta: [string, string, ReactNode][] = [
    ['رقم الفاتورة', 'Invoice No', <Num>{number}</Num>],
    ['تاريخ الفاتورة', 'Date', fmtDate(invoice.paid_at ?? invoice.created_at)],
  ]
  if (invoice.transaction_id) meta.push(['رقم العملية', 'Transaction', <Num>{invoice.transaction_id}</Num>])
  if (invoice.reference_no) meta.push(['الرقم المرجعي', 'Reference', <Num>{invoice.reference_no}</Num>])

  const payment: [string, string, ReactNode][] = []
  if (invoice.pay_method) payment.push(['طريقة الدفع', 'Method', invoice.pay_method])
  if (card) payment.push(['البطاقة', 'Card', <Num>{card}</Num>])
  if (invoice.auth_code) payment.push(['رمز التفويض', 'Auth code', <Num>{invoice.auth_code}</Num>])
  payment.push(['وقت الدفع', 'Paid at', fmtDateTime(invoice.paid_at ?? invoice.created_at)])

  const th: CSSProperties = { padding: '10px 12px', fontSize: 11, fontWeight: 700, color: '#fff', textAlign: 'start' }
  const td: CSSProperties = { padding: '12px', fontSize: 13, borderBottom: `1px solid ${LINE}`, verticalAlign: 'top' }

  return (
    <div
      dir="rtl"
      lang="ar"
      style={{
        width: A4_WIDTH,
        minHeight: A4_HEIGHT,
        boxSizing: 'border-box',
        background: '#fff',
        color: INK,
        fontFamily: FONT,
        fontSize: 13,
        lineHeight: 1.55,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div style={{ height: 10, background: accent }} />
      <div style={{ padding: '40px 56px 32px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Header: logo + seller on the start side, title on the end side */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 32 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            {settings?.logo ? (
              <img src={settings.logo} alt={seller} style={{ display: 'block', maxHeight: 54, maxWidth: 280, objectFit: 'contain', objectPosition: 'right' }} />
            ) : (
              <div style={{ fontSize: 30, fontWeight: 700, color: accent }}>{invoice.store_name}</div>
            )}
            <div style={{ marginTop: 16, fontSize: 15, fontWeight: 700 }}>{seller}</div>
            {sellerLines.map((l, i) => (
              <div key={i} style={{ fontSize: 12, color: MUTED }}>
                {l}
              </div>
            ))}
            {(settings?.tax_number || settings?.cr_number) && (
              <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
                {settings?.tax_number && (
                  <span>
                    الرقم الضريبي: <Num style={{ color: INK }}>{settings.tax_number}</Num>
                  </span>
                )}
                {settings?.tax_number && settings?.cr_number && <span style={{ margin: '0 8px' }}>·</span>}
                {settings?.cr_number && (
                  <span>
                    السجل التجاري: <Num style={{ color: INK }}>{settings.cr_number}</Num>
                  </span>
                )}
              </div>
            )}
          </div>
          <div style={{ textAlign: 'left', flexShrink: 0 }}>
            <div style={{ fontSize: 34, fontWeight: 700, lineHeight: 1.1 }}>{vatRate > 0 ? 'فاتورة ضريبية' : 'فاتورة'}</div>
            <div style={{ fontSize: 12, letterSpacing: 3, color: MUTED, marginTop: 4 }}>{vatRate > 0 ? 'TAX INVOICE' : 'INVOICE'}</div>
            <div style={{ display: 'inline-block', marginTop: 14, padding: '4px 14px', borderRadius: 999, background: '#e8f7ef', color: '#047857', fontSize: 12, fontWeight: 700 }}>
              مدفوعة · PAID
            </div>
          </div>
        </div>

        {/* Invoice meta */}
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${meta.length}, 1fr)`, gap: 16, marginTop: 32, padding: '16px 20px', background: SOFT, borderRadius: 14 }}>
          {meta.map(([ar, en, v]) => (
            <div key={en}>
              <Label ar={ar} en={en} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>

        {/* Customer */}
        <div style={{ marginTop: 24, paddingInlineStart: 16, borderInlineStart: `3px solid ${accent}` }}>
          <Label ar="فاتورة إلى" en="Bill to" />
          <div style={{ fontSize: 16, fontWeight: 700 }}>{invoice.customer_name || 'عميل'}</div>
          <div style={{ fontSize: 12, color: MUTED, display: 'flex', gap: 16 }}>
            {invoice.phone && <Num>{invoice.phone}</Num>}
            {invoice.email && <Num>{invoice.email}</Num>}
          </div>
        </div>

        {/* Items */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginTop: 28 }}>
          <thead>
            <tr style={{ background: INK }}>
              <th style={{ ...th, width: 36, borderStartStartRadius: 10, borderEndStartRadius: 10 }}>#</th>
              <th style={th}>الخدمة / المنتج</th>
              <th style={{ ...th, width: 70, textAlign: 'center' }}>الكمية</th>
              <th style={{ ...th, width: 110, textAlign: 'left' }}>سعر الوحدة</th>
              <th style={{ ...th, width: 120, textAlign: 'left', borderStartEndRadius: 10, borderEndEndRadius: 10 }}>الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            {invoice.lines.map((l, i) => (
              <tr key={l.item_id}>
                <td style={{ ...td, color: MUTED }}>
                  <Num>{i + 1}</Num>
                </td>
                <td style={td}>
                  <div style={{ fontWeight: 600 }}>{l.name}</div>
                  {(l.line_note || l.category_name) && <div style={{ fontSize: 11, color: MUTED }}>{l.line_note || l.category_name}</div>}
                </td>
                <td style={{ ...td, textAlign: 'center' }}>
                  <Num>{money(l.qty)}</Num>
                </td>
                <td style={{ ...td, textAlign: 'left' }}>
                  <Num>{money(l.unit_price)}</Num>
                </td>
                <td style={{ ...td, textAlign: 'left', fontWeight: 600 }}>
                  <Num>{money(l.qty * l.unit_price)}</Num>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 20 }}>
          <div style={{ width: 300 }}>
            {vatRate > 0 && (
              <>
                <TotalRow label="المجموع قبل الضريبة" value={subtotal} />
                <TotalRow label={`ضريبة القيمة المضافة (${money(vatRate)}٪)`} value={vat} />
              </>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8, padding: '14px 18px', borderRadius: 12, background: accent, color: '#fff' }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{vatRate > 0 ? 'الإجمالي شامل الضريبة' : 'الإجمالي'}</span>
              <span style={{ fontWeight: 700, fontSize: 20 }}>
                <Num>{money(total)}</Num> <span style={{ fontSize: 12 }}>ر.س</span>
              </span>
            </div>
          </div>
        </div>

        {/* Payment details + note */}
        <div style={{ marginTop: 28, display: 'grid', gridTemplateColumns: `repeat(${Math.min(payment.length, 4)}, 1fr)`, gap: 16, paddingTop: 18, borderTop: `1px solid ${LINE}` }}>
          {payment.map(([ar, en, v]) => (
            <div key={en}>
              <Label ar={ar} en={en} />
              <div style={{ fontSize: 13, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        {invoice.note && (
          <div style={{ marginTop: 20, padding: '12px 16px', background: SOFT, borderRadius: 12, fontSize: 12 }}>
            <span style={{ fontWeight: 700 }}>ملاحظات: </span>
            {invoice.note}
          </div>
        )}

        <div style={{ flex: 1 }} />

        {/* Footer */}
        <div style={{ marginTop: 32, paddingTop: 16, borderTop: `2px solid ${accent}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11, color: MUTED }}>
          <span>{settings?.footer_note || `شكراً لتعاملكم مع ${invoice.store_name}`}</span>
          <Num>{number}</Num>
        </div>
      </div>
    </div>
  )
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 18px', fontSize: 13, borderBottom: `1px solid ${LINE}` }}>
      <span style={{ color: MUTED }}>{label}</span>
      <span style={{ fontWeight: 600 }}>
        <Num>{money(value)}</Num> ر.س
      </span>
    </div>
  )
}
