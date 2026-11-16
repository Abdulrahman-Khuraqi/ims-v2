import { createElement } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { A4_HEIGHT, A4_WIDTH, InvoiceDocument } from '../components/InvoiceDocument'
import type { Invoice, InvoiceSettings } from '../types'

/**
 * Builds one PDF with one A4 page per invoice, each in its store's template.
 * Pages are rendered by the browser (so Arabic shaping and the app font are exact),
 * captured as images, and placed into the PDF with jsPDF. Libraries load only when used.
 */
export async function exportInvoicesPdf(
  invoices: Invoice[],
  settings: InvoiceSettings[],
  fileName: string,
  onProgress?: (done: number, total: number) => void,
) {
  const [{ jsPDF }, { toJpeg, getFontEmbedCSS }] = await Promise.all([import('jspdf'), import('html-to-image')])
  const byStore = new Map(settings.map((s) => [s.store_id, s]))

  const host = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, { position: 'fixed', top: '0', left: '-20000px', width: `${A4_WIDTH}px`, pointerEvents: 'none' })
  document.body.appendChild(host)
  const root = createRoot(host)

  try {
    await document.fonts.ready
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', compress: true })
    const pageW = pdf.internal.pageSize.getWidth()
    const pageH = pdf.internal.pageSize.getHeight()
    let fontEmbedCSS: string | undefined

    for (let i = 0; i < invoices.length; i++) {
      const inv = invoices[i]
      flushSync(() => root.render(createElement(InvoiceDocument, { invoice: inv, settings: byStore.get(inv.store_id) })))
      const page = host.firstElementChild as HTMLElement
      await Promise.all([...page.querySelectorAll('img')].map((img) => img.decode().catch(() => undefined)))
      // Font CSS is collected once and reused for every page (it is the slow part of html-to-image).
      fontEmbedCSS ??= await getFontEmbedCSS(page)
      const image = await toJpeg(page, { quality: 0.92, pixelRatio: 2, backgroundColor: '#ffffff', fontEmbedCSS })

      // Fit the page width; a very long invoice is scaled down to stay on one page.
      const h = page.offsetHeight || A4_HEIGHT
      const scale = Math.min(pageW / A4_WIDTH, pageH / h)
      const w = A4_WIDTH * scale
      if (i > 0) pdf.addPage()
      pdf.addImage(image, 'JPEG', (pageW - w) / 2, 0, w, h * scale, undefined, 'FAST')
      onProgress?.(i + 1, invoices.length)
      await new Promise((r) => setTimeout(r)) // keep the UI responsive between pages
    }
    pdf.setProperties({ title: fileName.replace(/\.pdf$/i, '') })
    // Our own link instead of pdf.save(): keeps the Arabic file name in every browser.
    const url = URL.createObjectURL(pdf.output('blob'))
    const a = Object.assign(document.createElement('a'), { href: url, download: fileName })
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 60_000)
  } finally {
    root.unmount()
    host.remove()
  }
}
