'use client';

import { useMemo, useState } from 'react';
import {
  CATEGORY_GROUPS,
  CATEGORY_GROUP_LABEL,
  CATEGORY_META,
  categoriesInGroup,
  estimateCommission,
  formatCedis,
  sanitiseCommissionRates,
  type CommissionRates,
  type IncidentCategory,
} from '@dawuro/core';
import { Panel } from '@/components/ui';

/**
 * The platform's commission rates, edited.
 *
 * Money is entered in cedis and stored in pesewas; the extras are entered as
 * percentages and stored as multipliers — nobody types 1.25. The example on the
 * right is the same calculation the phone runs, on the rates being edited, so
 * the effect of a change is read in the figure a reporter will see.
 */
export function CommissionRatesForm({ initial }: { initial: CommissionRates }) {
  const [rates, setRates] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [example, setExample] = useState<IncidentCategory>('fire');

  const dirty = JSON.stringify(rates) !== JSON.stringify(saved);

  const setCategory = (category: IncidentCategory, cedis: number) =>
    setRates((prev) => ({
      ...prev,
      categoryPesewas: { ...prev.categoryPesewas, [category]: Math.round(cedis * 100) },
    }));

  async function save() {
    setSaving(true);
    setNotice(null);
    // Clamped here too, so the form shows the value the service will be sent.
    const clean = sanitiseCommissionRates(rates);
    setRates(clean);
    try {
      const response = await fetch('/api/platform/commissions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clean),
      });
      const body = (await response.json().catch(() => null)) as
        | { rates?: CommissionRates; stored?: boolean; warning?: string; error?: string }
        | null;
      if (!response.ok || !body?.rates) {
        setNotice({ tone: 'error', text: body?.error ?? 'The rates could not be saved.' });
        return;
      }
      setRates(body.rates);
      setSaved(body.rates);
      setNotice(
        body.stored
          ? { tone: 'ok', text: 'Saved. Phones pick the new rates up within five minutes.' }
          : { tone: 'warn', text: body.warning ?? 'The service did not keep the rates.' },
      );
    } catch {
      setNotice({ tone: 'error', text: 'The console could not be reached. Nothing was changed.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-4 my-5 grid gap-4 sm:mx-7 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="space-y-4">
        <Panel className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold">How the rate is adjusted</h2>
          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <Percent
              label="Platform share"
              hint="Taken from each licence fee. The reporter receives the rest."
              value={Math.round(rates.platformFeeRate * 100)}
              min={0}
              max={90}
              onChange={(n) => setRates((r) => ({ ...r, platformFeeRate: n / 100 }))}
            />
            <Percent
              label="Extra for video"
              hint="Added to the category rate for footage."
              value={Math.round((rates.videoMultiplier - 1) * 100)}
              min={-50}
              max={200}
              onChange={(n) => setRates((r) => ({ ...r, videoMultiplier: 1 + n / 100 }))}
            />
            <Percent
              label="Extra for a voice recording"
              hint="Added for audio — between a photo and a video."
              value={Math.round((rates.audioMultiplier - 1) * 100)}
              min={-50}
              max={200}
              onChange={(n) => setRates((r) => ({ ...r, audioMultiplier: 1 + n / 100 }))}
            />
            <Percent
              label="Extra for an exclusive report"
              hint="Added when a reporter sends it to named organisations only."
              value={Math.round((rates.directedMultiplier - 1) * 100)}
              min={-50}
              max={200}
              onChange={(n) => setRates((r) => ({ ...r, directedMultiplier: 1 + n / 100 }))}
            />
            <Percent
              label="Low-accuracy location pays"
              hint="Of the normal rate, when the GPS fix was not precise."
              value={Math.round(rates.lowConfidenceMultiplier * 100)}
              min={10}
              max={100}
              onChange={(n) => setRates((r) => ({ ...r, lowConfidenceMultiplier: n / 100 }))}
            />
            <Percent
              label="Each extra organisation adds"
              hint="Of the fee, when more than one organisation licenses the same report."
              value={Math.round(rates.extraLicenseeShare * 100)}
              min={0}
              max={100}
              onChange={(n) => setRates((r) => ({ ...r, extraLicenseeShare: n / 100 }))}
            />
          </div>
        </Panel>

        <Panel className="p-5 sm:p-6">
          <h2 className="text-sm font-semibold">Rate per category</h2>
          <p className="mt-1 text-xs text-text-muted">
            The licence fee for a photo offered to organisations, before the extras above.
          </p>
          <div className="mt-4 space-y-5">
            {CATEGORY_GROUPS.map((group) => (
              <div key={group}>
                <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
                  {CATEGORY_GROUP_LABEL[group]}
                </p>
                <div className="mt-2 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  {categoriesInGroup(group).map((category) => (
                    <label key={category} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm">{CATEGORY_META[category].label}</span>
                      <span className="text-xs text-text-muted">GH₵</span>
                      <input
                        id={`rate-${category}`}
                        type="number"
                        min={0}
                        max={1000}
                        step={0.5}
                        value={rates.categoryPesewas[category] / 100}
                        onChange={(e) => setCategory(category, Number(e.target.value) || 0)}
                        onFocus={() => setExample(category)}
                        className="tabular h-8 w-24 rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-right text-sm"
                      />
                    </label>
                  ))}
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
            {saving ? 'Saving…' : 'Save rates'}
          </button>
          {dirty ? (
            <button
              type="button"
              onClick={() => {
                setRates(saved);
                setNotice(null);
              }}
              className="text-xs text-text-muted underline underline-offset-2"
            >
              Undo changes
            </button>
          ) : null}
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
      </div>

      <Example rates={rates} category={example} onCategory={setExample} />
    </div>
  );
}

function Percent({
  label,
  hint,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}) {
  const id = `pct-${label.replace(/\W+/g, '-').toLowerCase()}`;
  return (
    <div>
      <label htmlFor={id} className="text-xs font-semibold text-text-primary">
        {label}
      </label>
      <div className="mt-1.5 flex items-center gap-2">
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={5}
          value={value}
          onChange={(e) => onChange(Math.min(max, Math.max(min, Number(e.target.value) || 0)))}
          className="tabular h-9 w-24 rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-right text-sm"
        />
        <span className="text-sm text-text-muted">%</span>
      </div>
      <p className="mt-1 text-2xs leading-relaxed text-text-muted">{hint}</p>
    </div>
  );
}

/**
 * What a reporter would see before sending, on the rates being edited.
 *
 * The same `estimateCommission` the phone runs. A GPS fix of normal accuracy and
 * one organisation — the case a reporter sees on the review screen.
 */
function Example({
  rates,
  category,
  onCategory,
}: {
  rates: CommissionRates;
  category: IncidentCategory;
  onCategory: (category: IncidentCategory) => void;
}) {
  const rows = useMemo(
    () =>
      (['photo', 'audio', 'video'] as const).map((mediaKind) => ({
        mediaKind,
        offered: estimateCommission(
          { category, destination: 'marketplace', mediaKind, locationConfidence: 'high' },
          rates,
        ),
        exclusive: estimateCommission(
          { category, destination: 'directed', mediaKind, locationConfidence: 'high' },
          rates,
        ),
      })),
    [category, rates],
  );

  return (
    <Panel className="h-fit p-5 lg:sticky lg:top-5">
      <p className="text-xs font-semibold text-text-primary">What a reporter sees</p>
      <p className="mt-1 text-2xs text-text-muted">&ldquo;You could earn…&rdquo; before they send.</p>

      <label htmlFor="example-category" className="mt-4 block text-2xs font-medium text-text-secondary">
        Category
      </label>
      <select
        id="example-category"
        value={category}
        onChange={(e) => onCategory(e.target.value as IncidentCategory)}
        className="mt-1 h-9 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-sm"
      >
        {(Object.keys(CATEGORY_META) as IncidentCategory[]).map((c) => (
          <option key={c} value={c}>
            {CATEGORY_META[c].label}
          </option>
        ))}
      </select>

      <table className="mt-4 w-full text-xs">
        <thead>
          <tr className="text-left text-2xs uppercase tracking-wider text-text-faint">
            <th className="pb-2 font-medium" />
            <th className="pb-2 text-right font-medium">To organisations</th>
            <th className="pb-2 text-right font-medium">Exclusive</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.mediaKind} className="border-t border-hairline/[0.06]">
              <td className="py-2 capitalize">{row.mediaKind === 'audio' ? 'Voice' : row.mediaKind}</td>
              <td className="tabular py-2 text-right font-medium">{formatCedis(row.offered.reporterPesewas)}</td>
              <td className="tabular py-2 text-right font-medium">{formatCedis(row.exclusive.reporterPesewas)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-2xs leading-relaxed text-text-faint">
        The public feed pays nothing. Organisations can offer more than these for reports sent
        directly to them.
      </p>
    </Panel>
  );
}
