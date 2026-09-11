'use client';

import { useState } from 'react';
import { Panel } from '@/components/ui';

/**
 * The two numbers that decide how the top of the mobile feed behaves.
 *
 * Entered in seconds and stored in milliseconds, because nobody types 6000.
 *
 * The preview is not decoration. These are numbers whose effect is a *rhythm*,
 * and a rhythm cannot be judged from a digit — six seconds reads as a long time
 * in a form field and is barely enough to finish a four-line headline. The bar
 * below runs at the rate being set, so the decision is made by watching it.
 */
export function TopStoriesForm({
  initial,
  bounds,
}: {
  initial: { count: number; dwellSeconds: number; updatedAtIso: string; updatedByEmail: string };
  bounds: { count: { min: number; max: number }; dwell: { min: number; max: number } };
}) {
  const [count, setCount] = useState(initial.count);
  const [dwellSeconds, setDwell] = useState(initial.dwellSeconds);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(
    initial.updatedAtIso ? describeSaved(initial.updatedAtIso, initial.updatedByEmail) : null,
  );
  const [error, setError] = useState<string | null>(null);

  const dirty = count !== initial.count || dwellSeconds !== initial.dwellSeconds;

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/platform/top-stories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count, dwellSeconds }),
      });
      const body: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        /*
         * The server's own sentence. It is the one that knows the bounds, and
         * substituting a general "could not save" here would hide the only
         * thing that tells an operator what to change.
         */
        const message =
          body && typeof body === 'object' && 'error' in body
            ? String((body as { error: unknown }).error)
            : 'That could not be saved.';
        setError(message);
        return;
      }
      const row = body as { updatedAtIso?: string; updatedByEmail?: string };
      setSaved(describeSaved(row.updatedAtIso ?? new Date().toISOString(), row.updatedByEmail ?? ''));
    } catch {
      setError('The console could not be reached. Nothing was changed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-7 mt-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <Panel className="p-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field
            label="Stories in the rotation"
            hint={`${bounds.count.min}–${bounds.count.max}. The top of the published order — the desks' own ranking, not a second one.`}
            value={count}
            min={bounds.count.min}
            max={bounds.count.max}
            unit={count === 1 ? 'story' : 'stories'}
            onChange={setCount}
          />
          <Field
            label="Each one holds for"
            hint={`${bounds.dwell.min}–${bounds.dwell.max} seconds. Below three a headline cannot be finished; above twenty a reader assumes it is stuck.`}
            value={dwellSeconds}
            min={bounds.dwell.min}
            max={bounds.dwell.max}
            unit="seconds"
            onChange={setDwell}
          />
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-hairline/10 pt-5">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="inline-flex h-9 items-center rounded-sm bg-gradient-to-br from-accent to-accent-alt px-4 text-sm font-medium text-text-on-dark hover:brightness-110 disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {error ? <p className="text-xs text-danger">{error}</p> : null}
          {!error && saved && !dirty ? <p className="text-xs text-text-muted">{saved}</p> : null}
          {dirty && !error ? (
            <p className="text-xs text-text-muted">Not saved yet.</p>
          ) : null}
        </div>
      </Panel>

      <Preview count={count} dwellSeconds={dwellSeconds} />
    </div>
  );
}

function Field({
  label,
  hint,
  value,
  min,
  max,
  unit,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-text-primary">{label}</span>
      <div className="mt-2 flex items-center gap-3">
        <input
          type="range"
          min={min}
          max={max}
          step={1}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
          className="h-1 min-w-0 flex-1 accent-accent"
        />
        {/* The number in words beside the slider. A slider alone cannot be read
            back, and this is a setting somebody will be asked to confirm. */}
        <span className="w-24 shrink-0 text-sm tabular-nums text-text-primary">
          {value} <span className="text-text-muted">{unit}</span>
        </span>
      </div>
      <span className="mt-2 block text-xs leading-relaxed text-text-muted">{hint}</span>
    </label>
  );
}

/**
 * The rhythm, at the rate being set.
 *
 * A progress bar that fills over the dwell time and moves to the next slot,
 * looping through the chosen number of stories — the same behaviour the phone
 * will have. It is the only way to judge whether six seconds is generous or
 * mean without holding a phone.
 *
 * CSS animation rather than a timer: keyed on the two values so changing either
 * restarts it cleanly, and it costs no JavaScript while it runs.
 */
function Preview({ count, dwellSeconds }: { count: number; dwellSeconds: number }) {
  return (
    <Panel className="p-6">
      <p className="text-xs font-semibold text-text-primary">How it will feel</p>
      <p className="mt-1 text-xs leading-relaxed text-text-muted">
        {count === 1
          ? 'One story, held. Nothing rotates.'
          : `${count} stories, ${dwellSeconds}s each — a full turn every ${count * dwellSeconds}s.`}
      </p>

      <div key={`${count}-${dwellSeconds}`} className="mt-5 space-y-2">
        {Array.from({ length: count }, (_, slot) => (
          <div key={slot} className="h-1.5 overflow-hidden rounded-sm bg-hairline/15">
            <div
              className="h-full bg-accent"
              style={{
                animation: `dawuro-dwell ${count * dwellSeconds}s linear infinite`,
                animationDelay: `${slot * dwellSeconds}s`,
                transformOrigin: 'left',
              }}
            />
          </div>
        ))}
      </div>

      {/*
        Inline because it is one keyframe used in one place, and a global
        stylesheet entry for it would outlive the preview it exists for.

        Each bar fills during its own share of the cycle and sits empty for the
        rest, which is what makes the rotation legible as a rhythm rather than
        as four bars all moving at once.
      */}
      <style>{`
        @keyframes dawuro-dwell {
          0%, 100% { transform: scaleX(0); }
          ${(100 / Math.max(count, 1)).toFixed(3)}% { transform: scaleX(1); }
          ${(100 / Math.max(count, 1) + 0.01).toFixed(3)}% { transform: scaleX(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="dawuro-dwell"] { animation: none !important; transform: scaleX(1); }
        }
      `}</style>
    </Panel>
  );
}

function describeSaved(atIso: string, byEmail: string): string {
  const when = new Date(atIso);
  const stamp = Number.isNaN(when.getTime()) ? '' : when.toLocaleString();
  return byEmail ? `Saved ${stamp} by ${byEmail}.` : `Saved ${stamp}.`;
}
