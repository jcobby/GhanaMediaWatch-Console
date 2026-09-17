/**
 * `GET /platform/metrics`, in the shape the operations dashboard reads.
 *
 * The dashboard used to render these from a seeded constant, then — once that
 * was removed — said "not available yet", because no endpoint could answer
 * them. The service now measures them. Every figure is read as a safe integer or
 * not at all: a count or an amount the console cannot trust is shown as "—",
 * never as a number somebody might quote in a meeting.
 */

export interface DayCount {
  date: string;
  count: number;
}

export interface PlatformMetrics {
  generatedAtIso: string | null;
  submissionsToday: number | null;
  submissionsTotal: number | null;
  published: number | null;
  pendingReview: number | null;
  last14Days: DayCount[];
  organisationsTotal: number | null;
  organisationsActive: number | null;
  revenueThisMonthPesewas: number | null;
  subscriptionMrrPesewas: number | null;
  downloadChargesPesewas: number | null;
  payoutsReleasedThisMonthPesewas: number | null;
  routingPending: number | null;
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

const section = (source: Loose, key: string): Loose =>
  isRecord(source[key]) ? (source[key] as Loose) : {};

export function normaliseMetrics(raw: unknown): PlatformMetrics {
  const source: Loose = isRecord(raw) ? raw : {};
  const submissions = section(source, 'submissions');
  const organisations = section(source, 'organisations');
  const revenue = section(source, 'revenue');
  const routing = section(source, 'routing');

  const last14Days = (Array.isArray(submissions.last14Days) ? submissions.last14Days : [])
    .filter(isRecord)
    .flatMap((day) => {
      const n = count(day.count);
      return typeof day.date === 'string' && n !== null ? [{ date: day.date, count: n }] : [];
    })
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    generatedAtIso: typeof source.generatedAt === 'string' ? source.generatedAt : null,
    submissionsToday: count(submissions.today),
    submissionsTotal: count(submissions.total),
    published: count(submissions.published),
    pendingReview: count(submissions.pendingReview),
    last14Days,
    organisationsTotal: count(organisations.total),
    organisationsActive: count(organisations.active),
    revenueThisMonthPesewas: count(revenue.revenueThisMonthPesewas),
    subscriptionMrrPesewas: count(revenue.subscriptionMrrPesewas),
    downloadChargesPesewas: count(revenue.downloadChargesPesewasThisPeriod),
    payoutsReleasedThisMonthPesewas: count(revenue.payoutsReleasedThisMonthPesewas),
    routingPending: count(routing.pendingIncidents),
  };
}
