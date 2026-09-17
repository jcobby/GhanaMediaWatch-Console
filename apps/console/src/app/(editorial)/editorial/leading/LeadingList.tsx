'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { formatRelativeTime, type Incident } from '@dawuro/core';
import { Button, Panel } from '@/components/ui';
import { QueueThumb } from '../QueueThumb';

/** A leading report, with the fields `GET /editorial/leading` adds. */
type Led = Incident & {
  lead?: boolean;
  leadAt?: string | null;
  leadUntil?: string | null;
  section?: string | null;
};

/**
 * The current leads, grouped by desk, each with a way off the top.
 *
 * Grouped because the phone's rotation is per desk: two leads on Ghana and none
 * on Sport are two different front pages, and a flat list hides which desk is
 * crowded.
 */
export function LeadingList({ initial }: { initial: Incident[] }) {
  const [rows, setRows] = useState<Led[]>(initial as Led[]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = async (id: string) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/editorial/${encodeURIComponent(id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'lead', lead: false, leadUntil: null }),
      });
      if (!res.ok) {
        const answer = (await res.json()) as { error?: string; upstreamStatus?: number };
        setError(
          answer.error
            ? `${answer.error}${answer.upstreamStatus ? ` (${answer.upstreamStatus})` : ''}`
            : 'That lead could not be cleared.',
        );
        return;
      }
      setRows((previous) => previous.filter((row) => row.id !== id));
    } catch {
      setError('The console could not reach its own server. Nothing was changed.');
    } finally {
      setBusyId(null);
    }
  };

  const desks = new Map<string, Led[]>();
  for (const row of rows) {
    const key = row.section ?? 'no desk';
    desks.set(key, [...(desks.get(key) ?? []), row]);
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-7 py-6">
        {error ? (
          <p className="rounded-md border border-danger/25 bg-danger-wash p-3 text-xs text-danger">
            {error}
          </p>
        ) : null}

        {rows.length === 0 ? (
          <Panel className="p-10 text-center">
            <p className="text-sm text-text-secondary">Nothing is leading the feed.</p>
            <p className="mt-1 text-xs text-text-muted">
              The phone shows the newest reports on each desk as top stories. Lead a published
              report from{' '}
              <Link
                href="/editorial/decided"
                className="text-accent underline-offset-2 hover:underline"
              >
                Decided
              </Link>
              , or when you publish it on Triage.
            </p>
          </Panel>
        ) : (
          [...desks.entries()].map(([desk, items]) => (
            <section key={desk}>
              <h2 className="mb-2 flex items-baseline gap-2 text-2xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                {desk}
                <span className="tabular font-normal text-text-faint">{items.length}</span>
              </h2>
              <ul className="space-y-1.5">
                {items.map((row) => (
                  <li key={row.id}>
                    <Panel className="flex items-center gap-3 p-3">
                      <QueueThumb incident={row} />
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm leading-snug text-text-primary">
                          {row.description}
                        </p>
                        <p className="mt-1 flex items-center gap-1.5 text-2xs text-text-muted">
                          <Star className="h-3 w-3 fill-accent text-accent" strokeWidth={2} />
                          {row.leadAt ? `Led ${formatRelativeTime(row.leadAt) ?? 'recently'} ago` : 'Leading'}
                          {row.leadUntil
                            ? ` · until ${new Date(row.leadUntil).toLocaleString('en-GB', {
                                day: 'numeric',
                                month: 'short',
                                hour: 'numeric',
                                minute: '2-digit',
                              })}`
                            : ' · until cleared'}
                          <span className="font-mono text-text-faint">· {row.reportId}</span>
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={busyId === row.id}
                        onClick={() => void stop(row.id)}
                      >
                        Stop leading
                      </Button>
                    </Panel>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </div>
  );
}
