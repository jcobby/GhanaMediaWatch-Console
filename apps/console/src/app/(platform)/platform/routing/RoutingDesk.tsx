'use client';

import { useMemo, useState } from 'react';
import { Check, Plus, Search, Send, UserCircle2, MapPin, X } from 'lucide-react';
import {
  autoRoute,
  formatRelativeTime,
  type BusinessAccount,
  type RoutingItem,
} from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The routing desk.
 *
 * Reports route themselves — the matcher has already chosen recipients by the
 * time anything appears here. The operator's job is oversight: confirm what
 * the matcher decided, or override it when they know something the matcher
 * cannot, such as an ongoing investigation.
 *
 * So the auto-matched recipients are pre-selected rather than blank. An empty
 * form would imply the operator must route everything by hand, which is the
 * opposite of how the platform works and would not scale past a few hundred
 * reports a day.
 */
export function RoutingDesk({
  queue,
  businesses,
}: {
  queue: RoutingItem[];
  businesses: BusinessAccount[];
}) {
  const [handled, setHandled] = useState<Record<string, string[]>>({});
  const [selectedId, setSelectedId] = useState<string | null>(queue[0]?.id ?? null);

  const pending = queue.filter((item) => !(item.id in handled));
  const selected = queue.find((q) => q.id === selectedId) ?? pending[0] ?? null;

  return (
    <div className="flex h-[calc(100vh-5.5rem)]">
      <div className="flex w-[21rem] shrink-0 flex-col border-r border-hairline/[0.08]">
        <div className="border-b border-hairline/[0.08] px-4 py-2.5">
          <p className="text-xs text-text-muted">
            <span className="tabular font-semibold text-text-primary">{pending.length}</span>{' '}
            awaiting a decision
          </p>
        </div>
        <ul className="flex-1 overflow-y-auto">
          {queue.map((item) => {
            const active = selected?.id === item.id;
            const done = item.id in handled;
            return (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={cn(
                    'flex w-full gap-3 border-b border-hairline/[0.05] px-3 py-3 text-left transition',
                    active ? 'bg-accent-wash/50' : 'hover:bg-canvas-raise/60',
                    done && 'opacity-55',
                  )}
                >
                  <span className="h-14 w-11 shrink-0 overflow-hidden rounded-xs bg-canvas-raise">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="text-2xs uppercase tracking-wide text-text-muted">
                        {item.category}
                      </span>
                      {done ? (
                        <Check className="ml-auto h-3 w-3 text-success" strokeWidth={3} />
                      ) : null}
                    </span>
                    <span className="mt-0.5 block line-clamp-2 text-xs leading-snug">
                      {item.summary}
                    </span>
                    <span className="mt-1 block text-2xs text-text-faint">
                      {formatRelativeTime(item.submittedAtIso)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <RoutingPane
            key={selected.id}
            item={selected}
            businesses={businesses}
            routedTo={handled[selected.id] ?? null}
            onRoute={(ids) => setHandled((prev) => ({ ...prev, [selected.id]: ids }))}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-text-faint">The queue is clear.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function RoutingPane({
  item,
  businesses,
  routedTo,
  onRoute,
}: {
  item: RoutingItem;
  businesses: BusinessAccount[];
  routedTo: string[] | null;
  onRoute: (ids: string[]) => void;
}) {
  /*
   * The same matcher the phone and the business inbox run. Showing the
   * operator a different answer from the one the system acted on would make
   * this screen actively misleading.
   */
  const matches = useMemo(
    () =>
      autoRoute(
        {
          category: item.category,
          destination: item.destination,
          requestedBusinessIds: item.requestedBusinessIds,
          location: null,
        },
        businesses,
      ),
    [item, businesses],
  );

  const [selected, setSelected] = useState<string[]>(() => matches.map((m) => m.businessId));
  const [query, setQuery] = useState('');

  const toggle = (id: string) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const matchedIds = new Set(matches.map((m) => m.businessId));
  const others = businesses.filter((b) => !matchedIds.has(b.id));

  /*
   * Matches name and sector. Sector matters because an operator often knows the
   * kind of body they want ("some district assembly") before the exact name.
   * Anything already selected stays visible regardless of the query, so a
   * search cannot silently hide a recipient the operator just added.
   */
  const visibleOthers = others.filter((b) => {
    if (selected.includes(b.id)) return true;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return b.name.toLowerCase().includes(q) || b.sector.toLowerCase().includes(q);
  });
  const changed =
    selected.length !== matches.length || selected.some((id) => !matchedIds.has(id));

  return (
    <div className="mx-auto max-w-3xl px-8 py-6">
      <div className="flex gap-5">
        <div className="h-32 w-24 shrink-0 overflow-hidden rounded-sm bg-canvas-raise">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="accent">{item.category}</Badge>
            <Badge tone={item.destination === 'directed' ? 'info' : 'neutral'}>
              {item.destination}
            </Badge>
          </div>
          <p className="mt-2 text-base leading-relaxed">{item.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-text-muted">
            <span className="flex items-center gap-1.5">
              <UserCircle2 className="h-3.5 w-3.5" /> {item.reporterHandle}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {item.locationLabel ?? 'Location hidden'}
            </span>
            <span>{formatRelativeTime(item.submittedAtIso)}</span>
          </div>
        </div>
      </div>

      {routedTo ? (
        <Panel className="mt-6 flex items-center gap-3 border-success/25 bg-success-wash/40 p-4">
          <Check className="h-4 w-4 shrink-0 text-success" strokeWidth={2.5} />
          <p className="text-sm text-text-secondary">
            Sent to{' '}
            <span className="font-medium text-text-primary">
              {routedTo.length === 0
                ? 'nobody'
                : routedTo
                    .map((id) => businesses.find((b) => b.id === id)?.name ?? id)
                    .join(', ')}
            </span>
            .
          </p>
        </Panel>
      ) : (
        <>
          <section className="mt-6">
            <div className="flex items-baseline justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                Matched automatically
              </h2>
              {changed ? <Badge tone="warning">Overridden</Badge> : null}
            </div>
            <div className="mt-2 space-y-1.5">
              {matches.length === 0 ? (
                <p className="rounded-sm bg-canvas-raise px-3 py-2.5 text-xs text-text-muted">
                  No organisation matched. This report reaches nobody unless you route it.
                </p>
              ) : (
                matches.map((match) => {
                  const business = businesses.find((b) => b.id === match.businessId);
                  if (!business) return null;
                  return (
                    <RecipientRow
                      key={match.businessId}
                      name={business.name}
                      reason={match.reasons.join(' · ').replaceAll('_', ' ')}
                      selected={selected.includes(match.businessId)}
                      onToggle={() => toggle(match.businessId)}
                    />
                  );
                })
              )}
            </div>
          </section>

          <section className="mt-5">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-text-faint">
                Send to another organisation
              </h2>
              {/* Search rather than a wall of chips: this list grows with every
                  organisation that signs up, and an operator overriding a match
                  usually has one specific recipient in mind already. */}
              <div className="relative w-56">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search organisations"
                  aria-label="Search organisations to send this report to"
                  className="h-8 w-full rounded-sm border border-hairline/12 bg-canvas-soft pl-8 pr-2.5 text-xs placeholder:text-text-faint focus:border-accent"
                />
              </div>
            </div>

            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleOthers.length === 0 ? (
                <p className="w-full rounded-sm bg-canvas-raise px-3 py-2.5 text-xs text-text-muted">
                  No organisation matches &ldquo;{query}&rdquo;.
                </p>
              ) : (
                visibleOthers.map((business) => (
                  <button
                    key={business.id}
                    type="button"
                    onClick={() => toggle(business.id)}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-1 text-xs transition',
                      selected.includes(business.id)
                        ? 'border-accent bg-accent-wash text-accent'
                        : 'border-hairline/12 text-text-muted hover:border-accent/30 hover:text-text-primary',
                    )}
                  >
                    {selected.includes(business.id) ? (
                      <X className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {business.name}
                  </button>
                ))
              )}
            </div>
          </section>

          <div className="mt-6 flex items-center gap-3 border-t border-hairline/[0.08] pt-5">
            <Button onClick={() => onRoute(selected)} disabled={selected.length === 0}>
              <Send className="h-3.5 w-3.5" />
              {changed ? 'Send with override' : 'Confirm and send'}
            </Button>
            <Button variant="ghost" onClick={() => onRoute([])}>
              Send to nobody
            </Button>
            <p className="ml-auto text-xs text-text-faint">
              {selected.length} recipient{selected.length === 1 ? '' : 's'}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function RecipientRow({
  name,
  reason,
  selected,
  onToggle,
}: {
  name: string;
  reason: string;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-3 rounded-sm border px-3 py-2.5 transition',
        selected ? 'border-accent/30 bg-accent-wash/40' : 'border-hairline/[0.08] opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={selected}
        onChange={onToggle}
        className="h-3.5 w-3.5 accent-[rgb(var(--color-accent))]"
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{name}</span>
        <span className="block truncate text-2xs capitalize text-text-faint">{reason}</span>
      </span>
    </label>
  );
}
