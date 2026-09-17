'use client';

import { useState } from 'react';
import {
  CATEGORY_GROUPS,
  CATEGORY_GROUP_LABEL,
  CATEGORY_META,
  categoriesInGroup,
  estimateCommission,
  formatCedis,
  type CommissionRates,
  type IncidentCategory,
  type OrganisationOffer,
} from '@dawuro/core';
import { Panel } from '@/components/ui';

/**
 * An offer per category, beside the platform rate it has to beat.
 *
 * A blank field means "the platform rate". Beside each, what a reporter would
 * earn for a photo sent directly to this organisation — the figure they see on
 * the phone — so the offer is judged by its effect on them.
 */
export function OfferForm({
  platform,
  initial,
}: {
  platform: CommissionRates;
  initial: OrganisationOffer;
}) {
  const toDraft = (offer: OrganisationOffer) =>
    Object.fromEntries(
      Object.entries(offer.categoryPesewas).map(([c, p]) => [c, String((p ?? 0) / 100)]),
    ) as Partial<Record<IncidentCategory, string>>;

  const [draft, setDraft] = useState(() => toDraft(initial));
  const [saved, setSaved] = useState(() => toDraft(initial));
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);

  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);

  const pesewasOf = (category: IncidentCategory): number | null => {
    const raw = draft[category];
    if (raw === undefined || raw.trim() === '') return null;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
  };

  async function save() {
    setSaving(true);
    setNotice(null);
    const categoryPesewas: Partial<Record<IncidentCategory, number>> = {};
    for (const category of Object.keys(draft) as IncidentCategory[]) {
      const p = pesewasOf(category);
      if (p !== null) categoryPesewas[category] = p;
    }
    try {
      const response = await fetch('/api/org/commissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryPesewas }),
      });
      const body = (await response.json().catch(() => null)) as
        | { offer?: OrganisationOffer; dropped?: string[]; error?: string }
        | null;
      if (!response.ok || !body?.offer) {
        setNotice({ tone: 'error', text: body?.error ?? 'The offer could not be saved.' });
        return;
      }
      const next = toDraft(body.offer);
      setDraft(next);
      setSaved(next);
      const dropped = (body.dropped ?? []).map((c) => CATEGORY_META[c as IncidentCategory]?.label ?? c);
      setNotice(
        dropped.length
          ? {
              tone: 'warn',
              text: `Saved. Not above the platform rate, so removed: ${dropped.join(', ')}.`,
            }
          : { tone: 'ok', text: 'Saved. Reporters see your offer when they choose you.' },
      );
    } catch {
      setNotice({ tone: 'error', text: 'The console could not be reached. Nothing was changed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-4 my-5 space-y-4 sm:mx-7">
      <Panel className="p-5 sm:p-6">
        <div className="hidden grid-cols-[minmax(0,1fr)_7rem_8rem_8rem] gap-3 border-b border-hairline/[0.08] pb-2 text-2xs uppercase tracking-wider text-text-faint sm:grid">
          <span>Category</span>
          <span className="text-right">Platform rate</span>
          <span className="text-right">Your offer</span>
          <span className="text-right">Reporter earns</span>
        </div>

        <div className="space-y-5 pt-3">
          {CATEGORY_GROUPS.map((group) => (
            <div key={group}>
              <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
                {CATEGORY_GROUP_LABEL[group]}
              </p>
              <div className="mt-1.5 divide-y divide-hairline/[0.05]">
                {categoriesInGroup(group).map((category) => {
                  const base = platform.categoryPesewas[category];
                  const offer = pesewasOf(category);
                  const below = offer !== null && offer <= base;
                  const earns = estimateCommission(
                    {
                      category,
                      destination: 'directed',
                      mediaKind: 'photo',
                      locationConfidence: 'high',
                      offerPesewas: offer,
                    },
                    platform,
                  ).reporterPesewas;
                  return (
                    <div
                      key={category}
                      className="grid grid-cols-2 items-center gap-x-3 gap-y-1 py-2 sm:grid-cols-[minmax(0,1fr)_7rem_8rem_8rem]"
                    >
                      <span className="col-span-2 truncate text-sm sm:col-span-1">{CATEGORY_META[category].label}</span>
                      <span className="tabular text-xs text-text-muted sm:text-right">{formatCedis(base)}</span>
                      <span className="flex items-center justify-end gap-1.5">
                        <span className="text-xs text-text-muted">GH₵</span>
                        <input
                          id={`offer-${category}`}
                          aria-label={`Your offer for ${CATEGORY_META[category].label}`}
                          type="number"
                          min={0}
                          step={0.5}
                          placeholder={(base / 100).toFixed(2)}
                          value={draft[category] ?? ''}
                          onChange={(e) => setDraft((prev) => ({ ...prev, [category]: e.target.value }))}
                          className={
                            below
                              ? 'tabular h-8 w-24 rounded-sm border border-warning/50 bg-canvas-soft px-2 text-right text-sm'
                              : 'tabular h-8 w-24 rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-right text-sm'
                          }
                        />
                      </span>
                      <span
                        className={
                          offer !== null && !below
                            ? 'tabular text-right text-sm font-medium text-success'
                            : 'tabular text-right text-sm text-text-muted'
                        }
                      >
                        {formatCedis(earns)}
                      </span>
                      {below ? (
                        <span className="col-span-2 text-right text-2xs text-warning sm:col-span-4">
                          Not above the platform rate — reporters get the platform rate.
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={!dirty || saving}
          onClick={() => void save()}
          className="inline-flex h-9 items-center rounded-sm bg-gradient-to-br from-accent to-accent-alt px-4 text-sm font-medium text-text-on-dark hover:brightness-110 disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save offer'}
        </button>
        {notice ? (
          <p
            role={notice.tone === 'error' ? 'alert' : undefined}
            className={
              notice.tone === 'ok'
                ? 'text-xs text-success'
                : notice.tone === 'warn'
                  ? 'text-xs text-warning'
                  : 'text-xs text-danger'
            }
          >
            {notice.text}
          </p>
        ) : dirty ? (
          <p className="text-xs text-text-muted">Not saved yet.</p>
        ) : null}
      </div>
      <p className="text-2xs leading-relaxed text-text-faint">
        &ldquo;Reporter earns&rdquo; is for a photo sent directly to you, after the platform&rsquo;s
        share and the platform&rsquo;s extra for an exclusive report. Video and voice recordings earn
        more.
      </p>
    </div>
  );
}
