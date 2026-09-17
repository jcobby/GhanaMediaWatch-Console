'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Check,
  ChevronDown,
  Clock,
  Plus,
  RotateCw,
  Send,
  Users,
  Wallet,
} from 'lucide-react';
import { PLATFORM_FEE_RATE, formatCedis, formatRelativeTime } from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';
import {
  needsAttention,
  type Payment,
  type PayoutRun,
  type RunStatus,
  type UnpaidSummary,
} from '@/lib/payouts';

const RUN_STATUS: Record<RunStatus, { label: string; tone: 'warning' | 'info' | 'success' | 'danger' }> = {
  draft: { label: 'Open', tone: 'warning' },
  releasing: { label: 'Sending', tone: 'info' },
  released: { label: 'Released', tone: 'success' },
  partially_failed: { label: 'Some failed', tone: 'danger' },
};

const PAYMENT_STATUS: Record<
  Payment['status'],
  { label: string; tone: 'warning' | 'info' | 'success' | 'danger' }
> = {
  pending: { label: 'Waiting', tone: 'info' },
  sent: { label: 'Sent', tone: 'info' },
  paid: { label: 'Paid', tone: 'success' },
  failed: { label: 'Failed', tone: 'danger' },
  held: { label: 'Held', tone: 'warning' },
};

/**
 * Releasing what reporters have earned.
 *
 * The only screen in the console that moves money out, and the one where a
 * mistake is hardest to undo — a payout that has left is gone, and the person on
 * the other end of it filmed a fire for ₵25.
 *
 * So releasing is two steps rather than one button, and the confirm step
 * restates the amount and the headcount. After release, every payment is listed
 * with the service's own status: a batch can come back `partially_failed`, and
 * "Released" over a row of failures is how a reporter goes unpaid unnoticed.
 *
 * Nothing moves on screen until the service answers.
 */
export function PayoutsWorkspace({
  runs: initial,
  unpaid,
  embedded = false,
}: {
  runs: PayoutRun[];
  /**
   * What opening a batch would collect, or null when it could not be read.
   *
   * Null is not zero. Zero says there is nothing owed; not knowing says nothing
   * at all, and on the screen that sends money those must not look alike.
   *
   * **Required, and deliberately not defaulted.** It was optional, and the two
   * pages that mount this drifted in silence: `/platform/payouts` passed it and
   * `/admin/payouts` did not, so whether an operator could see what a new batch
   * would sweep up depended on which URL they arrived by — and the copy without
   * it was the admin one, which is where the Finance Officer who actually holds
   * `run_payouts` works. The person pressing release saw less than the person
   * who does not. A default of `null` made omitting it indistinguishable from a
   * failed read, so nothing could catch it; now the type does, and a caller that
   * genuinely cannot read the figure has to say `null` on purpose.
   */
  unpaid: UnpaidSummary | null;
  /** Inside a page that already provides the frame and padding. */
  embedded?: boolean;
}) {
  const router = useRouter();
  const [runs, setRuns] = useState(initial);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(
    // Open the runs that need somebody, so a failure is not hidden behind a click.
    () => new Set(initial.filter((run) => needsAttention(run) > 0).map((run) => run.id)),
  );

  const open = runs.filter((run) => run.status === 'draft');
  const history = runs.filter((run) => run.status !== 'draft');
  const openTotal = open.reduce((total, run) => total + run.totalPesewas, 0);
  const attention = runs.reduce((total, run) => total + needsAttention(run), 0);

  /** One action. The run on screen is replaced by the one the service returned. */
  const act = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setFailure(null);
    try {
      const res = await fetch('/api/platform/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let answer: { run?: PayoutRun; error?: string } | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as { run?: PayoutRun; error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok || !answer?.run) {
        setFailure(answer?.error ?? `That could not be sent — the service answered ${res.status}.`);
        return;
      }
      const run = answer.run;
      setRuns((prev) =>
        prev.some((r) => r.id === run.id) ? prev.map((r) => (r.id === run.id ? run : r)) : [run, ...prev],
      );
      if (needsAttention(run) > 0) setExpanded((prev) => new Set(prev).add(run.id));
      setConfirming(null);
      router.refresh();
    } catch {
      setFailure(
        'The console could not reach its own server. Check the batch status before trying again.',
      );
    } finally {
      setBusy(null);
    }
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const body = (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metric
          icon={<Wallet className="h-3.5 w-3.5" />}
          label="Ready to release"
          value={formatCedis(openTotal)}
          suffix={open.length === 1 ? '1 open batch' : `${open.length} open batches`}
        />
        <Metric
          icon={<AlertTriangle className="h-3.5 w-3.5" />}
          label="Needs attention"
          value={String(attention)}
          suffix="failed or held payments"
          warn={attention > 0}
        />
        <Metric
          icon={<Check className="h-3.5 w-3.5" />}
          label="Platform fee"
          value={`${Math.round(PLATFORM_FEE_RATE * 100)}%`}
          suffix="already deducted"
        />
      </div>

      {failure ? (
        <p
          role="alert"
          className="rounded-md border border-danger/25 bg-danger-wash px-4 py-2.5 text-sm text-danger"
        >
          {failure}
        </p>
      ) : null}

      {open.length > 0 ? (
        <section>
          <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
            Ready to release
          </h2>
          <div className="mt-2 space-y-2">
            {open.map((run) => (
              <OpenBatch
                key={run.id}
                run={run}
                confirming={confirming === run.id}
                releasing={busy === `release:${run.id}`}
                onStartConfirm={() => setConfirming(run.id)}
                onCancel={() => setConfirming(null)}
                onRelease={() => void act(`release:${run.id}`, { action: 'release', batchId: run.id })}
              />
            ))}
          </div>
        </section>
      ) : (
        <Panel className="flex flex-col items-center gap-3 p-8 text-center">
          <div>
            <p className="text-sm font-medium">Nothing to release</p>
            <p className="mt-1 text-xs text-text-muted">
              Start a batch to collect every unpaid commission. Starting one sends no money.
            </p>
          </div>

          {/*
            What the batch would actually contain.

            "All unpaid" was pressed blind: the operator opened a batch without
            being able to see the amount, the headcount, or that some of those
            reporters have nowhere to be paid. Said before the button, because
            afterwards it is a batch somebody has to decide whether to release.
          */}
          {unpaid === null ? (
            <p className="text-xs text-text-muted">
              What it would collect could not be read just now. Starting a batch still works —
              it will show its contents once it is open.
            </p>
          ) : unpaid.count === 0 ? (
            <p className="text-xs text-text-muted">
              Nothing is owed at the moment, so a new batch would be empty.
            </p>
          ) : (
            <div className="text-xs">
              <p className="text-text-secondary">
                It would collect{' '}
                <span className="tabular font-semibold text-text-primary">
                  {formatCedis(unpaid.totalPesewas)}
                </span>{' '}
                for <span className="tabular font-medium">{unpaid.reporterCount}</span>{' '}
                {unpaid.reporterCount === 1 ? 'reporter' : 'reporters'}.
              </p>
              {unpaid.withoutNumber > 0 ? (
                <p className="mt-1 text-text-muted">
                  <span className="tabular">{unpaid.withoutNumber}</span> of them{' '}
                  {unpaid.withoutNumber === 1 ? 'has' : 'have'} no payout number yet, so those
                  payments will be held rather than sent.
                </p>
              ) : null}
            </div>
          )}

          <Button
            variant="secondary"
            loading={busy === 'create'}
            onClick={() =>
              void act('create', { action: 'create', afterBatchId: runs[0]?.id ?? null })
            }
          >
            <Plus className="h-3.5 w-3.5" /> Start a batch
          </Button>
        </Panel>
      )}

      <section>
        <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Past runs
        </h2>
        {history.length === 0 ? (
          <p className="mt-2 text-xs text-text-muted">No batch has been released yet.</p>
        ) : (
          <div className="mt-2 space-y-1.5">
            {history.map((run) => (
              <PastRun
                key={run.id}
                run={run}
                open={expanded.has(run.id)}
                onToggle={() => toggle(run.id)}
                busy={busy}
                onRetry={(payment) =>
                  void act(`retry:${payment.id}`, {
                    action: 'retry',
                    entryId: payment.id,
                    attempt: `${payment.providerReference ?? ''}|${payment.failureReason ?? ''}`,
                  })
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );

  if (embedded) return body;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-7">{body}</div>
    </div>
  );
}

function OpenBatch({
  run,
  confirming,
  releasing,
  onStartConfirm,
  onCancel,
  onRelease,
}: {
  run: PayoutRun;
  confirming: boolean;
  releasing: boolean;
  onStartConfirm: () => void;
  onCancel: () => void;
  onRelease: () => void;
}) {
  const reporters = run.reporterCount;
  const perReporter = Math.round(run.totalPesewas / Math.max(1, reporters));
  const unpayable = run.payments.filter((p) => !p.msisdnMasked).length;

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-2xs uppercase tracking-wider text-text-faint">Mobile money release</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-[-0.02em]">
            {formatCedis(run.totalPesewas)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            to <span className="tabular font-medium">{reporters}</span>{' '}
            {reporters === 1 ? 'reporter' : 'reporters'}
            {reporters > 0 ? (
              <>
                {' '}
                · averaging <span className="tabular">{formatCedis(perReporter)}</span> each
              </>
            ) : null}
          </p>
        </div>
        <Badge tone="warning">Open</Badge>
      </div>

      <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-faint">
        {run.createdAtIso ? (
          <span className="flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Opened {formatRelativeTime(run.createdAtIso) ?? 'recently'}
          </span>
        ) : null}
        <span className="flex items-center gap-1.5">
          <Users className="h-3 w-3" />
          {run.payments.length} {run.payments.length === 1 ? 'payment' : 'payments'}
        </span>
      </p>

      {/* Said before release: the service holds these rather than failing the batch. */}
      {unpayable > 0 ? (
        <p className="mt-3 rounded-sm bg-warning-wash/40 px-3 py-2 text-2xs leading-relaxed text-text-secondary">
          {unpayable} {unpayable === 1 ? 'reporter has' : 'reporters have'} not saved a payout number.
          Their payments will be held, not sent, until they add one on their phone.
        </p>
      ) : null}

      {confirming ? (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning-wash/35 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2.2} />
            <div className="text-xs leading-relaxed">
              <p className="font-medium text-text-primary">
                Send {formatCedis(run.totalPesewas)} to {reporters}{' '}
                {reporters === 1 ? 'reporter' : 'reporters'}?
              </p>
              <p className="mt-0.5 text-text-muted">
                Payments go out immediately over mobile money and cannot be recalled.
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel} disabled={releasing}>
              Cancel
            </Button>
            <Button size="sm" loading={releasing} onClick={onRelease}>
              <Send className="h-3.5 w-3.5" /> Yes, release now
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-end border-t border-hairline/[0.07] pt-4">
          <Button onClick={onStartConfirm} disabled={run.payments.length === 0}>
            <Send className="h-3.5 w-3.5" /> Release batch
          </Button>
        </div>
      )}
    </Panel>
  );
}

function PastRun({
  run,
  open,
  onToggle,
  busy,
  onRetry,
}: {
  run: PayoutRun;
  open: boolean;
  onToggle: () => void;
  busy: string | null;
  onRetry: (payment: Payment) => void;
}) {
  const status = RUN_STATUS[run.status];
  const parts = [
    run.counts.paid ? `${run.counts.paid} paid` : null,
    run.counts.sent ? `${run.counts.sent} sent` : null,
    run.counts.pending ? `${run.counts.pending} waiting` : null,
    run.counts.failed ? `${run.counts.failed} failed` : null,
    run.counts.held ? `${run.counts.held} held` : null,
  ].filter(Boolean);
  const when = formatRelativeTime(run.releasedAtIso ?? run.createdAtIso ?? '');

  return (
    <Panel className={cn('overflow-hidden', needsAttention(run) > 0 && 'border-danger/25')}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center gap-3.5 p-3.5 text-left transition hover:bg-canvas-raise/40"
      >
        <div className="min-w-0 flex-1">
          <p className="tabular text-sm font-medium">{formatCedis(run.totalPesewas)}</p>
          <p className="truncate text-2xs text-text-muted">
            {run.reporterCount} {run.reporterCount === 1 ? 'reporter' : 'reporters'}
            {parts.length ? ` · ${parts.join(', ')}` : ''}
            {when ? ` · ${when}` : ''}
          </p>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
        <ChevronDown
          className={cn('h-4 w-4 shrink-0 text-text-faint transition', open && 'rotate-180')}
        />
      </button>

      {open ? (
        <div className="overflow-x-auto border-t border-hairline/[0.07]">
          {run.payments.length === 0 ? (
            <p className="p-3.5 text-xs text-text-muted">The service listed no payments for this run.</p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-2xs uppercase tracking-wider text-text-faint">
                  <th className="px-3.5 py-2 font-medium">To</th>
                  <th className="px-3.5 py-2 text-right font-medium">Amount</th>
                  <th className="px-3.5 py-2 font-medium">Status</th>
                  <th className="px-3.5 py-2 font-medium">Detail</th>
                  <th className="px-3.5 py-2" />
                </tr>
              </thead>
              <tbody>
                {run.payments.map((payment) => {
                  const tone = PAYMENT_STATUS[payment.status];
                  return (
                    <tr key={payment.id} className="border-t border-hairline/[0.05] align-top">
                      <td className="px-3.5 py-2.5">
                        <span className="tabular block whitespace-nowrap">
                          {payment.msisdnMasked ?? 'No payout number'}
                        </span>
                        <span className="text-2xs text-text-faint">{payment.network}</span>
                      </td>
                      <td className="tabular whitespace-nowrap px-3.5 py-2.5 text-right font-medium">
                        {formatCedis(payment.amountPesewas)}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <Badge tone={tone.tone}>{tone.label}</Badge>
                      </td>
                      <td className="max-w-[16rem] px-3.5 py-2.5 text-2xs leading-relaxed text-text-muted">
                        {payment.failureReason ??
                          (payment.providerReference ? `Ref ${payment.providerReference}` : '—')}
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        {/* Only a failure can be retried. A held payment waits for the
                            reporter's number; retrying it would fail the same way. */}
                        {payment.status === 'failed' ? (
                          <Button
                            size="sm"
                            variant="secondary"
                            loading={busy === `retry:${payment.id}`}
                            disabled={busy !== null && busy !== `retry:${payment.id}`}
                            onClick={() => onRetry(payment)}
                          >
                            <RotateCw className="h-3 w-3" /> Retry
                          </Button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      ) : null}
    </Panel>
  );
}

function Metric({
  icon,
  label,
  value,
  suffix,
  warn = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  warn?: boolean;
}) {
  return (
    <Panel className={cn('p-4', warn && 'border-danger/25')}>
      <p className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-text-faint">
        {icon}
        {label}
      </p>
      <p
        className={cn(
          'tabular mt-1.5 text-xl font-semibold tracking-[-0.01em]',
          warn && 'text-danger',
        )}
      >
        {value}
      </p>
      {suffix ? <p className="text-2xs text-text-muted">{suffix}</p> : null}
    </Panel>
  );
}
