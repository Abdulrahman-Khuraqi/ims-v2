import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Eye, ImagePlus, Trash2 } from 'lucide-react'
import { api, errorMessage } from '../../api'
import { useFeedback } from '../../components/Feedback'
import { A4_WIDTH, InvoiceDocument } from '../../components/InvoiceDocument'
import { Page, TopBar } from '../../components/Layout'
import { Sheet } from '../../components/Sheet'
import { Button, Card, ColorPicker, Field, Input, PageLoader, Textarea } from '../../components/ui'
import type { Invoice, InvoiceSettings } from '../../types'

const LOGO_MAX_BYTES = 300_000

/** Reads an uploaded logo as a data URL; raster images are scaled to at most 800px wide. */
async function readLogo(file: File): Promise<string> {
  const asDataUrl = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('تعذّرت قراءة الملف'))
      r.readAsDataURL(blob)
    })
  if (file.type === 'image/svg+xml') return asDataUrl(file)
  if (!/^image\/(png|jpeg|webp)$/.test(file.type)) throw new Error('اختر صورة PNG أو JPG أو WebP أو SVG')
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, 800 / bitmap.width)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return canvas.toDataURL('image/png')
}

/** Example invoice used for the template preview. */
function sampleInvoice(s: InvoiceSettings): Invoice {
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ')
  return {
    id: 1024,
    store_id: s.store_id,
    transaction_id: '1234567890',
    invoice_no: 'INV-01024',
    customer_name: 'اسم العميل',
    email: 'client@example.com',
    phone: '0500000000',
    amount: 2300,
    status: 'Paid',
    pay_method: 'مدى',
    card_type: 'mada',
    card_last4: '4242',
    terminal_id: null,
    reference_no: 'REF-7781',
    auth_code: '0A1B2C',
    created_at_src: now,
    paid_at: now,
    note: null,
    source: 'manual',
    created_at: now,
    updated_at: now,
    store_name: s.store_name,
    store_color: s.store_color,
    created_by_name: null,
    updated_by_name: null,
    lines: [
      { item_id: 1, name: 'تصميم هوية بصرية', kind: 'service', is_active: true, qty: 1, unit_price: 1800, line_note: null, category_name: 'خدمات', category_color: null },
      { item_id: 2, name: 'تصاميم سوشيال ميديا', kind: 'service', is_active: true, qty: 5, unit_price: 100, line_note: null, category_name: 'خدمات', category_color: null },
    ],
  }
}

export default function InvoiceTemplates() {
  const [list, setList] = useState<InvoiceSettings[] | null>(null)
  const [editing, setEditing] = useState<InvoiceSettings | null>(null)
  const { toast } = useFeedback()

  const load = async () => {
    try {
      setList((await api<{ settings: InvoiceSettings[] }>('invoice-settings')).settings)
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      <TopBar title="قوالب الفواتير" back />
      <Page>
        <p className="mb-4 px-1 text-[14px] text-muted">شعار وبيانات كل متجر تظهر في فواتير PDF. التصدير من صفحة الفواتير ← زر التصدير.</p>
        {!list ? (
          <PageLoader />
        ) : (
          <div className="space-y-2.5">
            {list.map((s) => (
              <Card key={s.store_id} onClick={() => setEditing(s)} className="flex items-center gap-4">
                <span className="flex h-14 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white p-2">
                  {s.logo ? <img src={s.logo} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[13px] text-[#64748b]">بدون شعار</span>}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[17px] font-semibold">{s.store_name}</span>
                  <span className="block truncate text-[14px] text-muted">{s.legal_name || 'لم تُضبط البيانات بعد'}</span>
                </span>
                <span className="size-4 shrink-0 rounded-full" style={{ background: s.accent_color || s.store_color }} />
              </Card>
            ))}
          </div>
        )}
      </Page>
      {editing && (
        <TemplateSheet
          settings={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null)
            await load()
          }}
        />
      )}
    </>
  )
}

function TemplateSheet({ settings, onClose, onSaved }: { settings: InvoiceSettings; onClose: () => void; onSaved: () => void }) {
  const { toast } = useFeedback()
  const [f, setF] = useState(() => ({
    logo: settings.logo ?? '',
    legal_name: settings.legal_name ?? '',
    tax_number: settings.tax_number ?? '',
    cr_number: settings.cr_number ?? '',
    address: settings.address ?? '',
    phone: settings.phone ?? '',
    email: settings.email ?? '',
    accent_color: settings.accent_color || settings.store_color,
    vat_rate: settings.vat_rate ? String(settings.vat_rate) : '',
    footer_note: settings.footer_note ?? '',
  }))
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }))
  const current: InvoiceSettings = { ...settings, ...f, vat_rate: Number(f.vat_rate) || 0, logo: f.logo || null }

  const pickLogo = async (file: File | undefined) => {
    if (!file) return
    try {
      const url = await readLogo(file)
      if (url.length > LOGO_MAX_BYTES) throw new Error('حجم الشعار كبير، استخدم صورة أصغر')
      setF((x) => ({ ...x, logo: url }))
    } catch (e) {
      toast(errorMessage(e), 'error')
    }
  }

  const save = async () => {
    setSaving(true)
    try {
      await api(`invoice-settings/${settings.store_id}`, { method: 'PUT', body: { ...f, vat_rate: f.vat_rate || 0 } })
      toast('تم حفظ قالب الفاتورة')
      onSaved()
    } catch (e) {
      toast(errorMessage(e), 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Sheet
        open
        onClose={onClose}
        title={`فاتورة ${settings.store_name}`}
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" size="lg" icon={<Eye className="size-5" />} onClick={() => setPreview(true)}>
              معاينة
            </Button>
            <Button block size="lg" loading={saving} onClick={save}>
              حفظ
            </Button>
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <p className="mb-2 text-[15px] font-medium">الشعار</p>
            <div className="flex items-center gap-3">
              <span className="flex h-20 flex-1 items-center justify-center overflow-hidden rounded-2xl border border-line bg-white p-3">
                {f.logo ? <img src={f.logo} alt="" className="max-h-full max-w-full object-contain" /> : <span className="text-[14px] text-[#64748b]">بدون شعار</span>}
              </span>
              <div className="flex flex-col gap-2">
                <Button variant="soft" size="sm" icon={<ImagePlus className="size-4" />} onClick={() => fileRef.current?.click()}>
                  {f.logo ? 'تغيير' : 'رفع'}
                </Button>
                {f.logo && (
                  <Button variant="secondary" size="sm" icon={<Trash2 className="size-4" />} onClick={() => setF((x) => ({ ...x, logo: '' }))}>
                    إزالة
                  </Button>
                )}
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              className="hidden"
              onChange={(e) => {
                pickLogo(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <p className="mt-1.5 text-[13px] text-muted">يُفضّل شعار بخلفية شفافة (SVG أو PNG).</p>
          </div>

          <Field label="الاسم في الفاتورة" hint="الاسم التجاري أو اسم المنشأة">
            <Input value={f.legal_name} onChange={set('legal_name')} placeholder={settings.store_name} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الرقم الضريبي">
              <Input value={f.tax_number} onChange={set('tax_number')} inputMode="numeric" dir="ltr" className="num" />
            </Field>
            <Field label="السجل التجاري">
              <Input value={f.cr_number} onChange={set('cr_number')} inputMode="numeric" dir="ltr" className="num" />
            </Field>
          </div>
          <Field label="نسبة ضريبة القيمة المضافة ٪" hint="اتركها فارغة إذا لم تكن مسجلاً في الضريبة. المبالغ تُعتبر شاملة الضريبة.">
            <Input value={f.vat_rate} onChange={set('vat_rate')} inputMode="decimal" placeholder="مثال: 15" dir="ltr" className="num" />
          </Field>
          <Field label="العنوان">
            <Input value={f.address} onChange={set('address')} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="الجوال">
              <Input type="tel" value={f.phone} onChange={set('phone')} dir="ltr" className="num" />
            </Field>
            <Field label="البريد الإلكتروني">
              <Input type="email" value={f.email} onChange={set('email')} dir="ltr" autoCapitalize="none" />
            </Field>
          </div>
          <Field label="لون الفاتورة">
            <ColorPicker value={f.accent_color} onChange={(c) => setF((x) => ({ ...x, accent_color: c }))} />
          </Field>
          <Field label="نص أسفل الفاتورة">
            <Textarea rows={2} value={f.footer_note} onChange={set('footer_note')} placeholder={`شكراً لتعاملكم مع ${settings.store_name}`} />
          </Field>
        </div>
      </Sheet>
      <Sheet open={preview} onClose={() => setPreview(false)} title="معاينة الفاتورة">
        <ScaledPreview>
          <InvoiceDocument invoice={sampleInvoice(current)} settings={current} />
        </ScaledPreview>
      </Sheet>
    </>
  )
}

/** Shrinks the A4 page to the sheet width. */
function ScaledPreview({ children }: { children: ReactNode }) {
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
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line shadow-card" style={{ height: 1123 * scale }}>
      <div style={{ width: A4_WIDTH, transform: `scale(${scale})`, transformOrigin: 'top right' }}>{children}</div>
    </div>
  )
}
