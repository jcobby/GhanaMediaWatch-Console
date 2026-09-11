'use client';

import { useState } from 'react';
import { Eye, EyeOff, Megaphone } from 'lucide-react';
import {
  CATEGORY_META,
  NEWS_SECTIONS,
  NEWS_SECTION_LABEL,
  formatCount,
  formatExactCapture,
  formatPlace,
  type OrganisationAccount,
  type Incident,
  type NewsSection,
} from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import { mediaHref } from '@/lib/mediaHref';
import { cn } from '@/lib/cn';

/**
 * Reports this organisation licensed, and what it did with them.
 *
 * Where the product's loop closes. An organisation licenses a report privately, then
 * decides whether the public sees it — and that release is a decision, not an
 * automatic consequence of paying for the footage.
 *
 * Released reports carry the organisation's name. That is the point: the public
 * can see who acted on what a citizen filmed, which is the only thing that
 * makes filing the next one feel worth doing.
 *
 * Releasing also decides the **desk** it runs on, which is why the picker below
 * is part of the release and not a setting somewhere else. The phone's home
 * screen is a newsroom feed navigated by desk; a report released without one
 * does not appear on it. That failure is silent — no error, no empty state,
 * the story simply is not there — so the desk is chosen here, deliberately,
 * before anything goes out.
 */
export function PublishedWorkspace({
  licensed,
  organisation,
}: {
  licensed: Incident[];
  organisation: OrganisationAccount;
}) {
  const [released, setReleased] = useState<Set<string>>(
    () => new Set(licensed[0] ? [licensed[0].id] : []),
  );

  /*
   * Seeded from each report rather than left blank. A required field with no
   * default makes an editor pick something to get past it, and "whatever
   * dismisses this" is not an editorial judgement. `ghana` is right for almost
   * every incident report; the picker is for the ones it is wrong for.
   */
  const [desks, setDesks] = useState<Record<string, NewsSection>>(() =>
    Object.fromEntries(licensed.map((i) => [i.id, i.section])),
  );

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-3 px-7 py-6">
        <Panel className="flex items-start gap-3 p-4">
          <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2} />
          <p className="text-xs leading-relaxed text-text-muted">
            Releasing puts a report on the public feed credited to {organisation.name}. Licensing it
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
            const desk = desks[incident.id] ?? incident.section;

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
                  posterUrl={mediaHref(incident.id)}
                  {...(incident.media.kind === 'video' ? { videoUrl: mediaHref(incident.id) } : {})}
                  alt={incident.description}
                  when={formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision)}
                  where={formatPlace(incident.location)}
                  isVideo={incident.media.kind === 'video'}
                  byteSize={incident.media.byteSize}
                />

                <div className="mt-3 border-t border-hairline/[0.07] pt-3">
                  <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
                    Desk
                  </p>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    {live
                      ? 'Where readers find this on the app. Changing it moves the story.'
                      : 'Where this will appear on the app. Not the same as its category.'}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {NEWS_SECTIONS.map((section) => (
                      <button
                        key={section}
                        type="button"
                        onClick={() => setDesks((prev) => ({ ...prev, [incident.id]: section }))}
                        aria-pressed={desk === section}
                        className={cn(
                          'rounded-pill border px-3 py-1.5 text-xs transition',
                          desk === section
                            ? 'border-accent bg-accent-wash text-accent'
                            : 'border-hairline/12 text-text-muted hover:border-accent/30',
                        )}
                      >
                        {NEWS_SECTION_LABEL[section]}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline/[0.07] pt-3">
                  <p className="flex items-center gap-2 text-xs text-text-muted">
                    {live ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-success" />
                        Credited to {organisation.name} · {NEWS_SECTION_LABEL[desk]}
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
