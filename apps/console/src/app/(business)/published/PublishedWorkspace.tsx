'use client';

import { useState } from 'react';
import { Eye, EyeOff, Megaphone } from 'lucide-react';
import {
  CATEGORY_META,
  formatCount,
  formatExactCapture,
  type BusinessAccount,
  type Incident,
} from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';

/**
 * Reports this organisation licensed, and what it did with them.
 *
 * Where the product's loop closes. A business licenses a report privately, then
 * decides whether the public sees it — and that release is a decision, not an
 * automatic consequence of paying for the footage.
 *
 * Released reports carry the organisation's name. That is the point: the public
 * can see who acted on what a citizen filmed, which is the only thing that
 * makes filing the next one feel worth doing.
 */
export function PublishedWorkspace({
  licensed,
  business,
}: {
  licensed: Incident[];
  business: BusinessAccount;
}) {
  const [released, setReleased] = useState<Set<string>>(
    () => new Set(licensed[0] ? [licensed[0].id] : []),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-3 px-7 py-6">
        <Panel className="flex items-start gap-3 p-4">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
          <p className="text-xs leading-relaxed text-text-muted">
            Releasing puts a report on the public feed credited to {business.name}. Licensing it
            does not — what you buy stays private until you decide otherwise.
          </p>
        </Panel>

        {licensed.length === 0 ? (
          <Panel className="p-10 text-center">
            <p className="text-sm font-medium">Nothing licensed yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Reports you pay for appear here, ready to release.
            </p>
          </Panel>
        ) : (
          licensed.map((incident) => {
            const live = released.has(incident.id);
            const meta = CATEGORY_META[incident.category];

            return (
              <Panel key={incident.id} className="p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    aria-hidden
                    className="h-2 w-2 rounded-pill"
                    style={{ backgroundColor: meta?.hue }}
                  />
                  <span className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-muted">
                    {meta?.label ?? incident.category}
                  </span>
                  {live ? <Badge tone="success">Live to the public</Badge> : <Badge>Private</Badge>}
                  {live ? (
                    <span className="ml-auto text-2xs text-text-faint">
                      {formatCount(incident.counts.reactions)} reactions
                    </span>
                  ) : null}
                </div>

                <p className="mt-2 text-sm leading-relaxed">{incident.description}</p>

                <MediaFrame
                  className="mt-3"
                  posterUrl={incident.media.posterUrl}
                  alt={incident.description}
                  when={formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision)}
                  where={incident.location.label}
                  isVideo={incident.media.kind === 'video'}
                />

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline/[0.07] pt-3">
                  <p className="flex items-center gap-2 text-xs text-text-muted">
                    {live ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-success" />
                        Credited to {business.name}
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-text-faint" />
                        Only your organisation can see this
                      </>
                    )}
                  </p>
                  <Button
                    size="sm"
                    variant={live ? 'secondary' : 'primary'}
                    onClick={() =>
                      setReleased((prev) => {
                        const next = new Set(prev);
                        if (live) next.delete(incident.id);
                        else next.add(incident.id);
                        return next;
                      })
                    }
                  >
                    {live ? 'Withhold' : 'Release publicly'}
                  </Button>
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </div>
  );
}
