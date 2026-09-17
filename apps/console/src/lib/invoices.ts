/**
 * Organisation invoices as `GET /org/invoices` and `GET /org/invoices/{id}` send them.
 *
 * The invoices page used to compute "this period" from the plan table and offer
 * to pay that figure through a checkout that took card numbers and sent them
 * nowhere. Invoices are real now: the service issues them with a status, a due
 * date, line items and a receipt once paid, and each one is paid on PayDirect's
 * own page.
 *
 * All money is integer pesewas. Line items are typed as "any object" in the
 * schema, so they are read defensively and a figure that is not a safe integer
 * is shown as absent rather than as a float.
 */

export type InvoiceStatus = 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';

export interface InvoiceLine {
  label: string;
  quantity: number | null;
  unitPesewas: number | null;
  amountPesewas: number | null;
}

export interface Invoice {
  id: string;
  status: InvoiceStatus;
  totalPesewas: number;
  dueAtIso: string | null;
  paidAtIso: string | null;
  /** Only an https link. Anything else is not rendered as a link. */
  receiptUrl: string | null;
  lines: InvoiceLine[];
  /** Open, with something to pay. The only state that offers a Pay button. */
  payable: boolean;
  overdue: boolean;
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

const integer = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) ? value : null;

function statusOf(value: unknown): InvoiceStatus {
  switch (value) {
    case 'draft':
    case 'open':
    case 'paid':
    case 'void':
    case 'uncollectible':
      return value;
    default:
      // Unknown is never `open`: an invoice the console cannot read is not one it offers to pay.
      return 'draft';
  }
}

function httpsOnly(value: unknown): string | null {
  const url = text(value);
  if (!url) return null;
  try {
    return new URL(url).protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

export function normaliseInvoice(raw: unknown, now: number = Date.now()): Invoice {
  const source: Loose = isRecord(raw) ? raw : {};
  const status = statusOf(source.status);
  const totalPesewas = Math.max(0, integer(source.totalPesewas) ?? 0);
  const dueAtIso = text(source.dueAt) ?? text(source.dueAtIso);

  const lines: InvoiceLine[] = (Array.isArray(source.lineItems) ? source.lineItems : [])
    .filter(isRecord)
    .map((line) => ({
      label: text(line.description) ?? text(line.label) ?? text(line.name) ?? 'Item',
      quantity: integer(line.quantity),
      unitPesewas: integer(line.unitPesewas) ?? integer(line.unitAmountPesewas),
      amountPesewas: integer(line.amountPesewas) ?? integer(line.totalPesewas),
    }));

  const payable = status === 'open' && totalPesewas > 0;
  const due = dueAtIso ? Date.parse(dueAtIso) : Number.NaN;

  return {
    id: text(source.id) ?? '',
    status,
    totalPesewas,
    dueAtIso,
    paidAtIso: text(source.paidAt) ?? text(source.paidAtIso),
    receiptUrl: httpsOnly(source.receiptUrl),
    lines,
    payable,
    overdue: payable && Number.isFinite(due) && due < now,
  };
}

export const INVOICE_STATUS_COPY: Record<
  InvoiceStatus | 'overdue',
  { label: string; tone: 'neutral' | 'good' | 'warn' | 'bad' }
> = {
  draft: { label: 'Not issued', tone: 'neutral' },
  open: { label: 'Due', tone: 'warn' },
  overdue: { label: 'Overdue', tone: 'bad' },
  paid: { label: 'Paid', tone: 'good' },
  void: { label: 'Cancelled', tone: 'neutral' },
  uncollectible: { label: 'Written off', tone: 'bad' },
};
