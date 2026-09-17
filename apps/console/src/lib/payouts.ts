/**
 * Payout batches as the service sends them, in the shape the payouts screens read.
 *
 * **The console's own type described a different API.** `PayoutBatch` in
 * `@dawuro/core` has `reporterCount`, `settledAtIso` and a status of
 * `draft | processing | settled`. The live `PayoutBatch` schema has none of
 * those: its status is `draft | releasing | released | partially_failed`, and it
 * carries each payment as an entry with its own status and failure reason. Read
 * through the old type, a released batch matched no status the screen knew and
 * every reporter count printed as `undefined`.
 *
 * **Phone numbers are masked here, before anything reaches a browser.** An
 * operator needs to see that a payment went to an MTN number ending 4567; they
 * do not need a list of every reporter's full mobile-money number on a screen in
 * a shared office.
 *
 * All money is integer pesewas. A value that is not a safe integer is read as
 * zero rather than carried as a float — an amount the console cannot trust is
 * not an amount it will show beside a release button.
 *
 * Pure, so it can be tested against the published schema.
 */

export type RunStatus = 'draft' | 'releasing' | 'released' | 'partially_failed';
export type PaymentStatus = 'pending' | 'sent' | 'paid' | 'failed' | 'held';
export type Network = 'MTN MoMo' | 'Telecel Cash' | 'AirtelTigo Money' | 'Unknown network';

export interface Payment {
  id: string;
  commissionId: string | null;
  userId: string | null;
  /** e.g. `+233 •• ••• 4567`. The full number never leaves the server. */
  msisdnMasked: string | null;
  network: Network;
  amountPesewas: number;
  status: PaymentStatus;
  providerReference: string | null;
  /** Why it failed, or why it is held — "no payout number", for one. */
  failureReason: string | null;
}

export interface PayoutRun {
  id: string;
  status: RunStatus;
  totalPesewas: number;
  createdAtIso: string | null;
  releasedAtIso: string | null;
  releasedBy: string | null;
  note: string | null;
  payments: Payment[];
  /** Distinct reporters, not payments: one reporter can have several commissions. */
  reporterCount: number;
  counts: Record<PaymentStatus, number>;
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

const pesewas = (value: unknown): number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : 0;

/**
 * A run status.
 *
 * Anything unrecognised is `releasing`, never `draft`. A draft is the one state
 * that offers a release button, and a status the console does not understand is
 * not a reason to offer to send money.
 */
function runStatusOf(value: unknown): RunStatus {
  switch (value) {
    case 'draft':
    case 'releasing':
    case 'released':
    case 'partially_failed':
      return value;
    case 'settled':
      return 'released';
    default:
      return 'releasing';
  }
}

function paymentStatusOf(value: unknown): PaymentStatus {
  switch (value) {
    case 'pending':
    case 'sent':
    case 'paid':
    case 'failed':
    case 'held':
      return value;
    default:
      return 'pending';
  }
}

/** The digits after Ghana's country code, or after a leading zero. */
function nationalDigits(msisdn: string): string | null {
  const digits = msisdn.replace(/\D/g, '');
  if (digits.startsWith('233') && digits.length === 12) return digits.slice(3);
  if (digits.startsWith('0') && digits.length === 10) return digits.slice(1);
  return digits.length === 9 ? digits : null;
}

/**
 * Which mobile-money network a Ghanaian number belongs to, by its prefix.
 *
 * Numbers can be ported between networks, so this is where the number was
 * issued rather than a guarantee of where it is today. It is shown as the
 * network a payment was addressed to, which is what the prefix does establish.
 */
export function networkOf(msisdn: string | null): Network {
  const national = msisdn ? nationalDigits(msisdn) : null;
  const prefix = national?.slice(0, 2);
  if (!prefix) return 'Unknown network';
  if (['24', '25', '53', '54', '55', '59'].includes(prefix)) return 'MTN MoMo';
  if (['20', '50'].includes(prefix)) return 'Telecel Cash';
  if (['26', '27', '56', '57'].includes(prefix)) return 'AirtelTigo Money';
  return 'Unknown network';
}

/** `+233 •• ••• 4567` — enough to recognise, not enough to reuse. */
export function maskMsisdn(msisdn: string | null): string | null {
  if (!msisdn) return null;
  const digits = msisdn.replace(/\D/g, '');
  if (digits.length < 4) return null;
  return `+233 •• ••• ${digits.slice(-4)}`;
}

export function normalisePayoutRun(raw: unknown): PayoutRun {
  const source: Loose = isRecord(raw) ? raw : {};

  const payments: Payment[] = (Array.isArray(source.entries) ? source.entries : [])
    .filter(isRecord)
    .map((entry, index) => {
      const msisdn = text(entry.msisdn);
      return {
        id: text(entry.id) ?? `entry-${index}`,
        commissionId: text(entry.commissionId),
        userId: text(entry.userId),
        msisdnMasked: maskMsisdn(msisdn),
        network: networkOf(msisdn),
        amountPesewas: pesewas(entry.amountPesewas),
        status: paymentStatusOf(entry.status),
        providerReference: text(entry.providerReference),
        failureReason: text(entry.failureReason) ?? text(entry.heldReason),
      };
    });

  const counts: Record<PaymentStatus, number> = { pending: 0, sent: 0, paid: 0, failed: 0, held: 0 };
  for (const payment of payments) counts[payment.status] += 1;

  const summed = payments.reduce((total, payment) => total + payment.amountPesewas, 0);
  const stated = pesewas(source.totalPesewas);

  return {
    id: text(source.id) ?? '',
    status: runStatusOf(source.status),
    // The service's total when it sends one; otherwise the integer sum of the payments.
    totalPesewas: stated > 0 || payments.length === 0 ? stated : summed,
    createdAtIso: text(source.createdAt) ?? text(source.createdAtIso),
    releasedAtIso: text(source.releasedAt) ?? text(source.releasedAtIso),
    releasedBy: text(source.releasedBy),
    note: text(source.note),
    payments,
    reporterCount: new Set(payments.map((p) => p.userId ?? p.id)).size,
    counts,
  };
}

/** Payments somebody has to look at: failed, or held for a reason. */
export function needsAttention(run: PayoutRun): number {
  return run.counts.failed + run.counts.held;
}

/** What opening a batch would collect. */
export interface UnpaidSummary {
  /** Commission rows, not reporters: one reporter can have several. */
  count: number;
  reporterCount: number;
  totalPesewas: number;
  /** Reporters with no payout number — their payments are held, not sent. */
  withoutNumber: number;
}

/**
 * The unpaid commissions a new batch would sweep up.
 *
 * Opening a batch takes "all unpaid", and until `GET /platform/commissions`
 * existed the operator pressed that blind — the one screen in the console that
 * moves money, asking for a decision about an amount it could not name.
 *
 * Counts and totals only. These rows carry each reporter's name, email and
 * mobile-money number, and none of that has any business on a screen in a shared
 * office when the question is "how much, to how many". The held count is the
 * exception worth surfacing, because those payments will not go out.
 */
export function summariseUnpaid(rows: unknown): UnpaidSummary {
  const items = (Array.isArray(rows) ? rows : []).filter(isRecord);
  const reporters = new Set<string>();
  const unpayable = new Set<string>();
  let totalPesewas = 0;

  for (const [index, row] of items.entries()) {
    totalPesewas += pesewas(row.amountPesewas);
    // Falling back to the row's own id counts an unidentified row as its own
    // reporter, which overstates the headcount rather than hiding somebody.
    const who = text(row.reporterId) ?? text(row.userId) ?? `row-${index}`;
    reporters.add(who);

    /*
     * `hasPayoutNumber` is the service's own answer; the number itself is only
     * consulted when it does not send one. A reporter with nowhere to be paid is
     * not an error — their payment is held until they add one on their phone.
     */
    const has =
      typeof row.hasPayoutNumber === 'boolean'
        ? row.hasPayoutNumber
        : Boolean(text(row.payoutMsisdn));
    if (!has) unpayable.add(who);
  }

  return {
    count: items.length,
    reporterCount: reporters.size,
    totalPesewas,
    withoutNumber: unpayable.size,
  };
}

/** Money that has actually left: sent to the provider, or confirmed paid. */
export function sentPesewas(run: PayoutRun): number {
  return run.payments
    .filter((p) => p.status === 'sent' || p.status === 'paid')
    .reduce((total, p) => total + p.amountPesewas, 0);
}
