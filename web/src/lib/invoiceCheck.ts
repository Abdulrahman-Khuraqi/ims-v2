import type { Invoice } from '../types'

/** Gateway statuses that mean the payment did not go through. */
const FAILED_STATUS = /fail|declin|cancel|refund|revers|reject|void|error|ملغ|مرفوض|فاشل|مسترد|مرتجع|خطأ/i

export type InvoiceProblem = 'unclassified' | 'no_amount' | 'failed'

export const PROBLEM_LABELS: Record<InvoiceProblem, string> = {
  unclassified: 'غير مصنّفة (بدون خدمة أو منتج)',
  no_amount: 'المبلغ صفر',
  failed: 'حالة الدفع غير ناجحة',
}

/** Why an invoice is not ready for a PDF; null when it is complete. */
export function invoiceProblem(inv: Invoice): InvoiceProblem | null {
  if (FAILED_STATUS.test(inv.status ?? '')) return 'failed'
  if (!(inv.amount > 0)) return 'no_amount'
  if (!inv.lines.length) return 'unclassified'
  return null
}
