'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { NewsValueState } from './NewsValuePanel';

/**
 * An editor's news-value assessment, loaded and saved.
 *
 * The panel used to hold this in React state and admit, in a permanent amber
 * box, that ten ratings would be gone on reload and no colleague would ever see
 * them. `GET`/`PUT /editorial/{id}/news-value` now exists, so it is stored.
 *
 * **Loaded per report, not per queue.** Forty rows would be forty requests to
 * draw a panel an editor opens one of. It is fetched when a report is selected
 * and kept for the session, so clicking back to a report is instant.
 *
 * **Saved on a delay, and merged.** Rating ten criteria is ten clicks in a few
 * seconds; a request each would be ten round trips and ten chances to land out
 * of order. They are coalesced into one `PUT` a beat after the last change, and
 * the endpoint merges, so what goes up is only what changed.
 *
 * **The version is carried and returned.** `If-Match` is what stops two editors
 * on one report overwriting each other — the conflict comes back as a sentence
 * for the person, not a silent loss of somebody else's judgement.
 */

/** Long enough to collect a burst of clicks, short enough to feel saved. */
const SAVE_DELAY_MS = 900;

export type SaveState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'saving' }
  | { status: 'saved'; atIso: string }
  | { status: 'conflict'; message: string }
  | { status: 'failed'; message: string };

/** What the store sends back alongside the assessment itself. */
interface StoredAssessment extends Partial<NewsValueState> {
  version?: number;
  assessedByName?: string | null;
  assessedAtIso?: string | null;
}

export function useStoredNewsValue(incidentId: string | null) {
  /** Assessments the editor has loaded or edited this session, by incident. */
  const [stored, setStored] = useState<Record<string, StoredAssessment | null>>({});
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });

  /** Versions last seen from the server, so `If-Match` is never a guess. */
  const versions = useRef<Record<string, number | undefined>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pending = useRef<{ id: string; state: NewsValueState } | null>(null);

  const loaded = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!incidentId || loaded.current.has(incidentId)) return;
    loaded.current.add(incidentId);

    let cancelled = false;
    setSaveState({ status: 'loading' });

    void (async () => {
      try {
        const res = await fetch(`/api/editorial/${encodeURIComponent(incidentId)}/news-value`);
        const answer = (await res.json()) as { assessment?: StoredAssessment | null };
        if (cancelled) return;

        const assessment = answer.assessment ?? null;
        versions.current[incidentId] = assessment?.version;
        setStored((prev) => ({ ...prev, [incidentId]: assessment }));
        setSaveState({ status: 'idle' });
      } catch {
        if (!cancelled) setSaveState({ status: 'idle' });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [incidentId]);

  const flush = useCallback(async () => {
    const queued = pending.current;
    pending.current = null;
    if (!queued) return;

    setSaveState({ status: 'saving' });
    try {
      const res = await fetch(`/api/editorial/${encodeURIComponent(queued.id)}/news-value`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gates: queued.state.gates,
          ratings: queued.state.ratings,
          modifiers: queued.state.modifiers,
          election: queued.state.election,
          ownership: queued.state.ownership,
          unassessed: queued.state.unassessed,
          ...(versions.current[queued.id] !== undefined
            ? { version: versions.current[queued.id] }
            : {}),
        }),
      });

      const answer = (await res.json()) as {
        assessment?: StoredAssessment;
        error?: string;
        conflict?: boolean;
      };

      if (res.status === 409) {
        setSaveState({
          status: 'conflict',
          message: answer.error ?? 'Somebody else has assessed this report since you opened it.',
        });
        return;
      }
      if (!res.ok) {
        setSaveState({ status: 'failed', message: answer.error ?? 'That could not be saved.' });
        return;
      }

      if (answer.assessment?.version !== undefined) {
        versions.current[queued.id] = answer.assessment.version;
      }
      setSaveState({ status: 'saved', atIso: new Date().toISOString() });
    } catch {
      setSaveState({
        status: 'failed',
        message: 'The console could not reach its own server. Nothing was saved.',
      });
    }
  }, []);

  /** Record a change, and save it a beat later. */
  const change = useCallback(
    (id: string, next: NewsValueState) => {
      pending.current = { id, state: next };
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), SAVE_DELAY_MS);
    },
    [flush],
  );

  /*
   * A pending save is sent before the tab closes.
   *
   * Without this, an editor who rates the last criterion and immediately closes
   * the tab loses that rating — and would have no reason to suspect it, because
   * every other one saved.
   */
  useEffect(() => {
    const send = () => {
      if (timer.current) clearTimeout(timer.current);
      void flush();
    };
    window.addEventListener('beforeunload', send);
    return () => window.removeEventListener('beforeunload', send);
  }, [flush]);

  return {
    /** The stored assessment for this report, or null when nobody has made one. */
    stored: incidentId ? (stored[incidentId] ?? null) : null,
    saveState,
    change,
  };
}
