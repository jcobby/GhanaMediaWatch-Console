'use client';

import { useCallback, useEffect, useState } from 'react';
import { Lock } from 'lucide-react';
import { formatRelativeTime } from '@dawuro/core';
import { Button } from '@/components/ui';
import type { InternalNote } from '@/lib/notes';

/**
 * The organisation's own notes on one report.
 *
 * Read from the service each time the report is opened, so a note a colleague
 * added this morning is on screen — and after adding one the list is read again
 * rather than appended to locally, so what is shown is what was stored.
 */
export function NotesPanel({ incidentId }: { incidentId: string }) {
  const [notes, setNotes] = useState<InternalNote[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const url = `/api/org/incidents/${encodeURIComponent(incidentId)}/notes`;

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(url);
      const answer = (await res.json().catch(() => null)) as
        | { notes?: InternalNote[]; error?: string }
        | null;
      if (!res.ok || !answer?.notes) {
        setLoadError(answer?.error ?? 'Notes could not be read just now.');
        return;
      }
      setLoadError(null);
      setNotes(answer.notes);
    } catch {
      setLoadError('Notes could not be read just now.');
    }
  }, [url]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const add = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: draft.trim() }),
      });
      const answer = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setSaveError(answer?.error ?? 'That note could not be saved.');
        return;
      }
      setDraft('');
      await refresh();
    } catch {
      setSaveError('The console could not reach its own server. The note was not saved.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="rounded-md border border-hairline/[0.07] bg-canvas-soft p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">Internal notes</h3>
        <span className="flex items-center gap-1 text-2xs text-text-faint">
          <Lock className="h-3 w-3" /> Only your organisation sees these
        </span>
      </div>

      <div className="mt-3 space-y-2">
        {notes === null && !loadError ? (
          <p className="text-xs text-text-faint">Reading notes…</p>
        ) : loadError ? (
          <p className="text-xs text-danger">{loadError}</p>
        ) : notes && notes.length === 0 ? (
          <p className="text-xs text-text-muted">No notes on this report yet.</p>
        ) : (
          notes?.map((note) => (
            <article key={note.id} className="rounded-sm bg-canvas-raise/50 px-3 py-2">
              <p className="whitespace-pre-wrap text-xs leading-relaxed text-text-primary">
                {note.body}
              </p>
              <p className="mt-1 text-2xs text-text-faint">
                {note.authorName}
                {note.createdAtIso ? ` · ${formatRelativeTime(note.createdAtIso) ?? ''}` : ''}
              </p>
            </article>
          ))
        )}
      </div>

      <label htmlFor={`note-${incidentId}`} className="sr-only">
        Add a note
      </label>
      <textarea
        id={`note-${incidentId}`}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        rows={2}
        maxLength={2000}
        placeholder="Add a note for your colleagues"
        className="mt-3 w-full rounded-sm border border-hairline/15 bg-canvas px-3 py-2 text-sm"
      />
      {saveError ? (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {saveError}
        </p>
      ) : null}
      <div className="mt-2 flex justify-end">
        <Button size="sm" loading={saving} disabled={!draft.trim()} onClick={() => void add()}>
          Add note
        </Button>
      </div>
    </section>
  );
}
