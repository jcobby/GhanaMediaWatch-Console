'use client';

import { useState } from 'react';
import { AlertTriangle, Check, Clock, Loader2, Send, Users, Wallet } from 'lucide-react';
import {
  PLATFORM_FEE_RATE,
  formatCedis,
  formatRelativeTime,
  type CommissionEntry,
  type PayoutBatch,
} from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

const STATUS: Record<
  PayoutBatch['status'],
  { label: string; tone: 'warning' | 'info' | 'success' }
> = {
  draft: { label: 'Open', tone: 'warning' },
  processing: { label: 'Processing', tone: 'info' },
  settled: { label: 'Settled', tone: 'success' },
};

/**
 * Releasing what reporters have earned.
 *
 * This is the only screen in the console that moves money out of the organisation,
 * and the one where a mistake is hardest to undo — a payout that has left is
 * gone, and the person on the other end of it filmed a fire for ₵25.
 *
 * So releasing is deliberately two steps rather than one button. The confirm
 * step restates the amount and the headcount, because "release" on its own is
 * a word that gets clicked, and a number that has been read twice is much
 * harder to get wrong.
 *
 * Settled batches are shown but have no controls at all. There is nothing to
 * decide about money that has already left, and offering a disabled button
 * implies there might be.
 */
export function PayoutsWorkspace({
  batches,
  ledger,
}: {
  batches: PayoutBatch[];
  ledger: CommissionEntry[];
}) {
  const [released, setReleased] = useState<Set<string>>(new Set());
  const [confirming, setConfirming] = useState<string | null>(null);

  const open = batches.filter((b) => b.status === 'draft' && !released.has(b.id));
  const history = batches.filter((b) => b.status !== 'draft' || released.has(b.id));

  /*
   * Owed is what is earned but not yet paid. Void entries are excluded because
   * they represent reports that were withdrawn or rejected after the fact —
   * counting them would overstate the platform's liability.
   */
  const owed = ledger
    .filter((e) => e.status === 'pending')
    .reduce((sum, e) => sum + e.amountPesewas, 0);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-5 px-7 py-6">
        {/* What is owed right now, before any batch is opened. */}
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric
            icon={<Wallet className="h-3.5 w-3.5" />}
            label="Owed to reporters"
            value={formatCedis(owed)}
          />
          <Metric
            icon={<Users className="h-3.5 w-3.5" />}
            label="In the open batch"
            value={open.length > 0 ? String(open[0]!.reporterCount) : '0'}
            suffix="reporters"
          />
          <Metric
            icon={<Check className="h-3.5 w-3.5" />}
            label="Platform fee"
            value={`${Math.round(PLATFORM_FEE_RATE * 100)}%`}
            suffix="already deducted"
          />
        </div>

        {open.length > 0 ? (
          <section>
            <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
              Ready to release
            </h2>
            <div className="mt-2 space-y-2">
              {open.map((batch) => (
                <OpenBatch
                  key={batch.id}
                  batch={batch}
                  confirming={confirming === batch.id}
                  onStartConfirm={() => setConfirming(batch.id)}
                  onCancel={() => setConfirming(null)}
                  onRelease={() => {
                    setReleased((prev) => new Set(prev).add(batch.id));
                    setConfirming(null);
                  }}
                />
              ))}
            </div>
          </section>
        ) : (
          <Panel className="p-8 text-center">
            <p className="text-sm font-medium">Nothing to release</p>
            <p className="mt-1 text-xs text-text-muted">
              Earnings accumulate into a new batch as reports are licensed.
            </p>
          </Panel>
        )}

        <section>
          <h2 className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
            Past runs
          </h2>
          <div className="mt-2 space-y-1.5">
            {history.map((batch) => {
              const justReleased = released.has(batch.id);
              const status = justReleased ? STATUS.processing : STATUS[batch.status];
              return (
                <Panel key={batch.id} className="flex items-center gap-3.5 p-3.5">
                  <span
                    className={cn(
                      'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm',
                      justReleased ? 'bg-info-wash' : 'bg-success-wash',
                    )}
                  >
                    {justReleased ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-info" strokeWidth={2.2} />
                    ) : (
                      <Check className="h-3.5 w-3.5 text-success" strokeWidth={2.6} />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="tabular text-sm font-medium">{formatCedis(batch.totalPesewas)}</p>
                    <p className="text-2xs text-text-muted">
                      {batch.reporterCount} reporters ·{' '}
                      {formatRelativeTime(batch.settledAtIso ?? batch.createdAtIso) ?? 'recently'}
                    </p>
                  </div>
                  <Badge tone={status.tone}>{status.label}</Badge>
                </Panel>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function OpenBatch({
  batch,
  confirming,
  onStartConfirm,
  onCancel,
  onRelease,
}: {
  batch: PayoutBatch;
  confirming: boolean;
  onStartConfirm: () => void;
  onCancel: () => void;
  onRelease: () => void;
}) {
  const perReporter = Math.round(batch.totalPesewas / Math.max(1, batch.reporterCount));

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-2xs uppercase tracking-wider text-text-faint">Mobile money release</p>
          <p className="tabular mt-1 text-3xl font-semibold tracking-[-0.02em]">
            {formatCedis(batch.totalPesewas)}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            to <span className="tabular font-medium">{batch.reporterCount}</span> reporters ·
            averaging <span className="tabular">{formatCedis(perReporter)}</span> each
          </p>
        </div>
        <Badge tone="warning">Open</Badge>
      </div>

      <p className="mt-3 flex items-center gap-1.5 text-2xs text-text-faint">
        <Clock className="h-3 w-3" />
        Opened {formatRelativeTime(batch.createdAtIso) ?? 'recently'}
      </p>

      {confirming ? (
        <div className="mt-4 rounded-md border border-warning/30 bg-warning-wash/35 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2.2} />
            <div className="text-xs leading-relaxed">
              <p className="font-medium text-text-primary">
                Send {formatCedis(batch.totalPesewas)} to {batch.reporterCount} reporters?
              </p>
              <p className="mt-0.5 text-text-muted">
                Payments go out immediately over mobile money and cannot be recalled.
              </p>
            </div>
          </div>
          <div className="mt-3.5 flex items-center justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={onRelease}>
              <Send className="h-3.5 w-3.5" /> Yes, release now
            </Button>
          </div>
        </div>
      ) : (
        <div className="mt-4 flex items-center justify-end border-t border-hairline/[0.07] pt-4">
          <Button onClick={onStartConfirm}>
            <Send className="h-3.5 w-3.5" /> Release batch
          </Button>
        </div>
      )}
    </Panel>
  );
}

function Metric({
  icon,
  label,
  value,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
}) {
  return (
    <Panel className="p-4">
      <p className="flex items-center gap-1.5 text-2xs uppercase tracking-wider text-text-faint">
        {icon}
        {label}
      </p>
      <p className="tabular mt-1.5 text-xl font-semibold tracking-[-0.01em]">{value}</p>
      {suffix ? <p className="text-2xs text-text-muted">{suffix}</p> : null}
    </Panel>
  );
}
