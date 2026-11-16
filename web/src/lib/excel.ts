import * as XLSX from 'xlsx'
import type { Invoice } from '../types'
import { payLabel, KIND_LABELS } from './format'

/** One invoice row read from an Excel file, before it's assigned to a store. */
export interface ParsedRow {
  transaction_id: string
  invoice_no: string | null
  customer_name: string | null
  email: string | null
  phone: string | null
  amount: number
  status: string | null
  pay_method: string | null
  card_type: string | null
  card_last4: string | null
  terminal_id: string | null
  reference_no: string | null
  auth_code: string | null
  created_at_src: string | null
  paid_at: string | null
  /** Template/export files only: */
  store_name: string | null
  item_name: string | null
  note: string | null
}

export interface ParsedFile {
  fileName: string
  format: 'gateway' | 'template' | 'payments'
  rows: ParsedRow[]
  errors: string[]
}

// Column headers of the app's own template/export (Arabic) and the payment gateway export.
const TEMPLATE_COLUMNS = {
  store: 'المتجر',
  date: 'التاريخ',
  amount: 'المبلغ',
  customer: 'اسم العميل',
  phone: 'الجوال',
  email: 'الإيميل',
  invoiceNo: 'رقم الفاتورة',
  payMethod: 'طريقة الدفع',
  item: 'الخدمة/المنتج',
  note: 'ملاحظة',
  cardType: 'نوع البطاقة',
  last4: 'آخر 4 أرقام',
  txn: 'رقم العملية',
  ref: 'الرقم المرجعي',
  auth: 'رمز التفويض',
  terminal: 'رقم الجهاز',
} as const

const pad = (n: number) => String(n).padStart(2, '0')

const fmtLocal = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`

/** Saudi time (UTC+3, no DST) of an absolute instant, as "YYYY-MM-DD HH:MM:SS". */
const fmtRiyadh = (d: Date) => fmtLocal(new Date(d.getTime() + 3 * 3600_000 + d.getTimezoneOffset() * 60_000))

/** "2:30 PM" / "14:30" / "2:30 م" → [hours, minutes, seconds] in 24h. */
function parseTime(h: string | undefined, m: string | undefined, s: string | undefined, ampm: string | undefined): [number, number, number] {
  let hh = +(h ?? 0)
  const p = ampm?.toLowerCase()
  if ((p === 'pm' || p === 'م') && hh < 12) hh += 12
  if ((p === 'am' || p === 'ص') && hh === 12) hh = 0
  return [hh, +(m ?? 0), +(s ?? 0)]
}

const TIME = String.raw`(?:[ T,]+(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?\s*(AM|PM|am|pm|ص|م)?)?`

/** Excel serial day number (e.g. 46336.48) → "YYYY-MM-DD HH:MM:SS", for date cells saved without a date format. */
function serialDate(n: number): string {
  const d = new Date(Math.round((n - 25569) * 86400) * 1000)
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
}

function cellDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return fmtLocal(v)
  if (typeof v === 'number' && v > 20000 && v < 80000) return serialDate(v)
  if (typeof v !== 'string') return null
  const s = toLatinDigits(v.trim())
  if (!s) return null
  // ISO with a time zone (e.g. 2026-11-10T11:30:00Z or +03:00): convert to Saudi time.
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}.*(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s)
    if (!isNaN(d.getTime())) return fmtRiyadh(d)
  }
  let m = s.match(new RegExp(String.raw`^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})` + TIME))
  if (m) {
    const [hh, mm, ss] = parseTime(m[4], m[5], m[6], m[7])
    return `${m[1]}-${pad(+m[2])}-${pad(+m[3])} ${pad(hh)}:${pad(mm)}:${pad(ss)}`
  }
  // Day-first dates as typed in Saudi Arabia: 20/10/2026
  m = s.match(new RegExp(String.raw`^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})` + TIME))
  if (m) {
    const [hh, mm, ss] = parseTime(m[4], m[5], m[6], m[7])
    return `${m[3]}-${pad(+m[2])}-${pad(+m[1])} ${pad(hh)}:${pad(mm)}:${pad(ss)}`
  }
  // English month names: "Nov 10, 2026 2:30 PM", "10 November 2026 14:30"
  if (/[a-z]{3}/i.test(s)) {
    const d = new Date(s.replace(/\bat\b/i, ' '))
    if (!isNaN(d.getTime()) && d.getFullYear() > 2000) return fmtLocal(d)
  }
  return null
}

/** Joins a separate date cell and time cell ("2026-11-10" + "2:30 PM"). */
function cellDateTime(date: unknown, time: unknown): string | null {
  const d = cellDate(date)
  if (!d) return null
  if (time instanceof Date && !isNaN(time.getTime())) return `${d.slice(0, 10)} ${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`
  if (typeof time === 'number' && time >= 0 && time < 1) return `${d.slice(0, 10)} ${serialDate(25569 + time).slice(11)}`
  const t = typeof time === 'string' ? toLatinDigits(time.trim()).match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM|am|pm|ص|م)?/) : null
  if (!t) return d
  const [hh, mm, ss] = parseTime(t[1], t[2], t[3], t[4])
  return `${d.slice(0, 10)} ${pad(hh)}:${pad(mm)}:${pad(ss)}`
}

function toLatinDigits(s: string) {
  return s.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/٫/g, '.').replace(/٬/g, ',')
}

function cellMoney(v: unknown): number | null {
  if (typeof v === 'number') return Math.round(v * 100) / 100
  if (typeof v === 'string') {
    let s = toLatinDigits(v).replace(/[^\d.,\-]/g, '')
    // Decimal comma ("1200,50" or "1.200,50"); "1,500" with three digits after the comma stays thousands.
    if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$|^-?\d+,\d{1,2}$/.test(s)) s = s.replace(/\./g, '').replace(',', '.')
    const n = parseFloat(s.replace(/,/g, ''))
    return isNaN(n) ? null : Math.round(n * 100) / 100
  }
  return null
}

function cellStr(v: unknown): string | null {
  if (v === null || v === undefined) return null
  if (v instanceof Date) return cellDate(v)
  const s = String(v).trim()
  return s === '' ? null : s
}

/** Stable id for template rows that have no gateway TransactionID, so re-importing the same file adds nothing. */
function rowFingerprint(parts: (string | number | null)[]): string {
  const str = parts.map((p) => String(p ?? '')).join('|')
  let h1 = 0xdeadbeef ^ str.length
  let h2 = 0x41c6ce57 ^ str.length
  for (let i = 0; i < str.length; i++) {
    const c = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 2654435761)
    h2 = Math.imul(h2 ^ c, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return 'tpl-' + (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}

export async function parseExcelFile(file: File): Promise<ParsedFile> {
  return parseWorkbook(await file.arrayBuffer(), file.name)
}

/** Decodes CSV bytes: UTF-8 (with or without BOM), falling back to Windows-1256 for Arabic files saved by old Excel. */
function decodeText(bytes: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes).replace(/^\uFEFF/, '')
  } catch {
    return new TextDecoder('windows-1256').decode(bytes)
  }
}

/** Picks the separator that appears most in the header line: comma, tab or semicolon. */
function sniffSeparator(text: string): string {
  const header = text.split(/\r?\n/, 1)[0] ?? ''
  const count = (c: string) => header.split(c).length - 1
  return ['\t', ';', ','].reduce((best, c) => (count(c) > count(best) ? c : best), ',')
}

export function parseWorkbook(data: ArrayBuffer | Uint8Array, fileName: string): ParsedFile {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const isText = /\.(csv|tsv|txt)$/i.test(fileName)
  let wb: XLSX.WorkBook
  if (isText) {
    // Text files: keep every cell as typed (long ids stay exact, dates are parsed by us, not guessed).
    const text = decodeText(bytes)
    wb = XLSX.read(text, { type: 'string', raw: true, FS: sniffSeparator(text) })
  } else {
    wb = XLSX.read(bytes, { type: 'array', cellDates: true })
  }
  const sheet = wb.Sheets[wb.SheetNames[0]]
  if (!sheet) return { fileName, format: 'gateway', rows: [], errors: ['الملف فارغ'] }
  const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null, raw: true })
  const headers = Object.keys(records[0] ?? {}).map((h) => h.trim())

  if (headers.includes('TransactionID') && headers.includes('TotalAmount')) {
    return parseGateway(records, fileName)
  }
  if (headers.includes(TEMPLATE_COLUMNS.amount) && headers.includes(TEMPLATE_COLUMNS.date)) {
    return parseTemplate(records, fileName)
  }
  const keys = new Set(headers.map(headerKey))
  if (keys.has('amount') && (keys.has('checkoutid') || (keys.has('reference') && (keys.has('paidat') || keys.has('date'))))) {
    return parsePayments(records, fileName)
  }
  return {
    fileName,
    format: 'gateway',
    rows: [],
    errors: ['صيغة الملف غير معروفة. استخدم ملف بوابة الدفع (Checkouts) أو ملف المدفوعات (Checkout ID) أو قالب Excel الخاص بالنظام'],
  }
}

/** "Card last 4" → "cardlast4": header names compared without case, spaces or punctuation. */
const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

/** Card brand from the method column ("Visa", "MasterCard", "Mada"…), shown next to the last 4 digits. */
function cardBrand(v: string | null): string | null {
  if (!v) return null
  const k = v.toLowerCase().replace(/[\s_-]/g, '')
  if (k.includes('visa')) return 'Visa'
  if (k.includes('master')) return 'MasterCard'
  if (k.includes('amex') || k.includes('americanexpress')) return 'American Express'
  if (k.includes('mada') || v.includes('مدى')) return 'mada'
  return null
}

/** Payment method names from payment pages → the app's codes (anything else is kept as written). */
function payMethodCode(v: string | null): string | null {
  if (!v) return null
  const k = v.toLowerCase().replace(/[\s_-]/g, '')
  if (k.includes('applepay')) return 'ApplePay'
  if (k.includes('samsungpay')) return 'SamsungPay'
  if (k.includes('mada') || v.includes('مدى')) return 'Mada'
  if (/^(card|creditcard|debitcard|visa|mastercard|master|amex|americanexpress|cc)$/.test(k)) return 'Card'
  if (k.includes('cash') || v.includes('نقد')) return 'Cash'
  if (k.includes('transfer') || k.includes('bank') || v.includes('تحويل')) return 'Transfer'
  return v
}

/**
 * Payments exports. Two layouts are known:
 *   Date, Time, Reference, Name, Email, Amount, Currency, Status, Mode, Gateway, Method, Card last 4, Services, Paid at, Checkout ID
 *   Reference, Created, Status, Amount, Currency, Gateway, Name, Email, Services, Card ("Visa •••• 1234"), Paid at, Gateway reference, Test
 * The store is chosen on the import screen (the files have no store column); "Services" is matched to the catalog.
 */
function parsePayments(records: Record<string, unknown>[], fileName: string): ParsedFile {
  const rows: ParsedRow[] = []
  const errors: string[] = []
  let testRows = 0
  records.forEach((raw, i) => {
    const r: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) r[headerKey(k)] = typeof v === 'string' ? v.trim() : v
    if (!Object.values(r).some((v) => v !== null && v !== '')) return

    // Test-mode payments are not real money.
    const mode = cellStr(r.mode)?.toLowerCase()
    const testFlag = cellStr(r.test)?.toLowerCase()
    if ((mode && /test|sandbox|تجريب/.test(mode)) || (testFlag && /^(1|yes|true|y|نعم|test)$/.test(testFlag))) {
      testRows++
      return
    }
    const amount = cellMoney(r.amount)
    const created = cellDateTime(r.date, r.time) ?? cellDate(r.created)
    const paid = cellDate(r.paidat) ?? created
    if (amount === null || !paid) {
      errors.push(`الصف ${i + 2}: المبلغ والتاريخ مطلوبان`)
      return
    }
    const reference = cellStr(r.reference)
    const name = cellStr(r.name)
    const email = cellStr(r.email)
    const services = (cellStr(r.services) ?? '')
      .split(/\s*[,،;|]\s*|\n/)
      .map((s) => s.trim())
      .filter(Boolean)
    const currency = cellStr(r.currency)?.toUpperCase()
    // The note prints on PDF invoices, so it only carries what the invoice can't show elsewhere.
    const notes = [
      services.length > 1 ? `الخدمات: ${services.join('، ')}` : null,
      currency && currency !== 'SAR' ? `العملة: ${currency}` : null,
    ].filter(Boolean)
    const card = cellStr(r.card)
    const method = cellStr(r.method) ?? (card ? card.replace(/[\d•*·.\s]+$/, '').trim() || null : null)
    // "Card last 4" column, or a single "Card" column like "Visa •••• 1234" / "Mada".
    const digits = (cellStr(r.cardlast4) ?? card)?.replace(/\D/g, '').slice(-4) || null
    // Excel may store "0042" as the number 42.
    const last4 = digits && typeof r.cardlast4 === 'number' ? digits.padStart(4, '0') : digits

    rows.push({
      transaction_id: cellStr(r.checkoutid) ?? cellStr(r.gatewayreference) ?? reference ?? rowFingerprint(['pay', paid, amount, name, email]),
      invoice_no: null,
      customer_name: name,
      email,
      phone: cellStr(r.phone),
      amount,
      status: cellStr(r.status) ?? 'Paid',
      pay_method: payMethodCode(method),
      card_type: cardBrand(method),
      card_last4: last4,
      terminal_id: null,
      reference_no: reference,
      auth_code: null,
      created_at_src: created,
      paid_at: paid,
      store_name: null,
      item_name: services[0] ?? null,
      note: notes.length ? notes.join(' · ') : null,
    })
  })
  if (testRows) errors.push(`تم تجاهل ${testRows} عملية تجريبية (Mode: test)`)
  return { fileName, format: 'payments', rows, errors }
}

function parseGateway(records: Record<string, unknown>[], fileName: string): ParsedFile {
  const rows: ParsedRow[] = []
  const errors: string[] = []
  records.forEach((r, i) => {
    const txn = cellStr(r.TransactionID)
    const amount = cellMoney(r.TotalAmount)
    if (!txn || amount === null) {
      if (Object.values(r).some((v) => v !== null)) errors.push(`الصف ${i + 2}: لا يوجد رقم عملية أو مبلغ`)
      return
    }
    rows.push({
      transaction_id: txn,
      invoice_no: cellStr(r.InvoiceNo),
      customer_name: cellStr(r.Name),
      email: cellStr(r.Email),
      phone: cellStr(r.Phone),
      amount,
      status: cellStr(r.StatusTitle),
      pay_method: cellStr(r.PayMethodTitle),
      card_type: cellStr(r.CardTypeTitle),
      card_last4: cellStr(r.CardLast4),
      terminal_id: cellStr(r.TerminalID),
      reference_no: cellStr(r.TransactionReferenceNumber),
      auth_code: cellStr(r.AuthCode),
      created_at_src: cellDate(r.CreateDate),
      paid_at: cellDate(r.PaidDate) ?? cellDate(r.CreateDate),
      store_name: null,
      item_name: null,
      note: null,
    })
  })
  return { fileName, format: 'gateway', rows, errors }
}

function parseTemplate(records: Record<string, unknown>[], fileName: string): ParsedFile {
  const C = TEMPLATE_COLUMNS
  const rows: ParsedRow[] = []
  const errors: string[] = []
  const payByLabel = new Map([
    ['بطاقة', 'Card'], ['Apple Pay', 'ApplePay'], ['Samsung Pay', 'SamsungPay'], ['مدى', 'Mada'],
    ['نقدي', 'Cash'], ['تحويل بنكي', 'Transfer'], ['أخرى', 'Other'],
  ])
  records.forEach((r, i) => {
    if (!Object.values(r).some((v) => v !== null && String(v).trim() !== '')) return
    const amount = cellMoney(r[C.amount])
    const paid = cellDate(r[C.date])
    if (amount === null || !paid) {
      errors.push(`الصف ${i + 2}: المبلغ والتاريخ مطلوبان`)
      return
    }
    const store = cellStr(r[C.store])
    const customer = cellStr(r[C.customer])
    const phone = cellStr(r[C.phone])
    const invoiceNo = cellStr(r[C.invoiceNo])
    const pay = cellStr(r[C.payMethod])
    rows.push({
      transaction_id: cellStr(r[C.txn]) ?? rowFingerprint([store, paid, amount, customer, phone, invoiceNo]),
      invoice_no: invoiceNo,
      customer_name: customer,
      email: cellStr(r[C.email]),
      phone,
      amount,
      status: 'Paid',
      pay_method: pay ? payByLabel.get(pay) ?? pay : null,
      card_type: cellStr(r[C.cardType]),
      card_last4: cellStr(r[C.last4]),
      terminal_id: cellStr(r[C.terminal]),
      reference_no: cellStr(r[C.ref]),
      auth_code: cellStr(r[C.auth]),
      created_at_src: null,
      paid_at: paid,
      store_name: store,
      // Exports list several items joined with "، "; only the first is matched on import.
      item_name: cellStr(r[C.item])?.split('، ')[0] ?? null,
      note: cellStr(r[C.note]),
    })
  })
  return { fileName, format: 'template', rows, errors }
}

function saveWorkbook(wb: XLSX.WorkBook, fileName: string) {
  wb.Workbook = { Views: [{ RTL: true }] }
  XLSX.writeFile(wb, fileName, { compression: true })
}

function sheetFrom(rows: Record<string, unknown>[], widths: number[]) {
  const ws = XLSX.utils.json_to_sheet(rows)
  ws['!cols'] = widths.map((wch) => ({ wch }))
  return ws
}

/** Exports invoices with the template's columns, so the file can be edited and re-imported. */
export function exportInvoices(invoices: Invoice[], fileName: string) {
  const C = TEMPLATE_COLUMNS
  const rows = invoices.map((inv) => ({
    [C.store]: inv.store_name,
    [C.date]: inv.paid_at ?? inv.created_at,
    [C.amount]: inv.amount,
    [C.customer]: inv.customer_name ?? '',
    [C.phone]: inv.phone ?? '',
    [C.email]: inv.email ?? '',
    [C.invoiceNo]: inv.invoice_no ?? '',
    [C.payMethod]: inv.pay_method ? payLabel(inv.pay_method) : '',
    [C.item]: inv.lines.map((l) => l.name).join('، '),
    'النوع': [...new Set(inv.lines.map((l) => KIND_LABELS[l.kind]))].join('، '),
    'التصنيف': [...new Set(inv.lines.map((l) => l.category_name).filter(Boolean))].join('، '),
    [C.note]: inv.note ?? '',
    [C.cardType]: inv.card_type ?? '',
    [C.last4]: inv.card_last4 ?? '',
    [C.txn]: inv.transaction_id ?? '',
    [C.ref]: inv.reference_no ?? '',
    [C.auth]: inv.auth_code ?? '',
    [C.terminal]: inv.terminal_id ?? '',
    'المصدر': inv.source === 'import' ? 'استيراد' : 'يدوي',
  }))
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheetFrom(rows, [16, 20, 12, 24, 16, 24, 12, 12, 24, 10, 14, 30, 12, 10, 34, 16, 12, 16, 8]), 'الفواتير')
  saveWorkbook(wb, fileName)
}

/** Empty template with example rows for adding many invoices at once from Excel. */
export function downloadTemplate(storeNames: string[]) {
  const C = TEMPLATE_COLUMNS
  const example = (store: string, date: string, amount: number, customer: string, phone: string, item: string) => ({
    [C.store]: store, [C.date]: date, [C.amount]: amount, [C.customer]: customer, [C.phone]: phone,
    [C.email]: '', [C.invoiceNo]: '', [C.payMethod]: 'بطاقة', [C.item]: item, [C.note]: '',
  })
  const rows = [
    example(storeNames[0] ?? 'اسم المتجر', '2026-10-20 14:30', 1500, 'مثال: أحمد علي', '0551234567', 'اسم الخدمة أو المنتج'),
    example(storeNames[1] ?? storeNames[0] ?? 'اسم المتجر', '2026-10-21', 250, 'مثال: سارة', '', ''),
  ]
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, sheetFrom(rows, [16, 20, 12, 24, 16, 24, 12, 12, 24, 30]), 'الفواتير')
  const help = [
    ['طريقة الاستخدام'],
    ['• احذف صفوف المثال واكتب فواتيرك، فاتورة في كل صف.'],
    ['• المبلغ والتاريخ مطلوبان. التاريخ بصيغة 2026-10-20 أو 20/10/2026، ويمكن إضافة الوقت.'],
    ['• المتجر: اكتب اسم المتجر كما هو في النظام: ' + storeNames.join('، ')],
    ['• طريقة الدفع: بطاقة، مدى، Apple Pay، Samsung Pay، نقدي، تحويل بنكي، أخرى.'],
    ['• الخدمة/المنتج: اكتب الاسم كما هو في قائمة الخدمات والمنتجات حتى تُربط تلقائياً.'],
    ['• استيراد نفس الملف مرة ثانية لا يكرر الفواتير.'],
  ]
  const ws = XLSX.utils.aoa_to_sheet(help)
  ws['!cols'] = [{ wch: 90 }]
  XLSX.utils.book_append_sheet(wb, ws, 'تعليمات')
  saveWorkbook(wb, 'قالب-الفواتير.xlsx')
}

/** Multi-sheet report export. */
export function exportReport(sheets: { name: string; rows: Record<string, unknown>[] }[], fileName: string) {
  const wb = XLSX.utils.book_new()
  for (const s of sheets) {
    const ws = XLSX.utils.json_to_sheet(s.rows)
    ws['!cols'] = Object.keys(s.rows[0] ?? {}).map(() => ({ wch: 22 }))
    XLSX.utils.book_append_sheet(wb, ws, s.name.slice(0, 31))
  }
  saveWorkbook(wb, fileName)
}
