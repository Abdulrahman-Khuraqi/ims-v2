import { api } from '../api'
import type { InvoiceSettings } from '../types'

/** Store invoice templates, fetched once and shared by the invoice preview and the PDF export. */
let cache: Promise<InvoiceSettings[]> | null = null

export function loadInvoiceSettings(): Promise<InvoiceSettings[]> {
  cache ??= api<{ settings: InvoiceSettings[] }>('invoice-settings')
    .then((r) => r.settings)
    .catch((e) => {
      cache = null
      throw e
    })
  return cache
}

/** Call after a template is saved so the next preview shows the change. */
export function invalidateInvoiceSettings() {
  cache = null
}
