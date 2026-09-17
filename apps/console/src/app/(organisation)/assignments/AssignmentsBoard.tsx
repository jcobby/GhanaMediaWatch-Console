'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatRelativeTime } from '@dawuro/core';
import { Button } from '@/components/ui';
import { Pill, Table } from '@/components/admin/Widgets';
import {
  ADVANCE_LABEL,
  ASSIGNMENT_LABEL,
  nextStatus,
  type Assignment,
  type AssignmentUpdate,
} from '@/lib/assignments';

/**
 * Who has been sent where, and moving each dispatch along.
 *
 * One button per row, for the one step after the current one. Closing asks for
 * an optional note first, because "closed" on its own tells the next reader
 * nothing about what was found.
 *
 * A row changes only once the service accepts the step.
 */
export function AssignmentsBoard({ assignments }: { assignments: Assignment[] }) {
  const router = useRouter();
  const [rows, setRows] = useState(assignments);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null);
  const [closing, setClosing] = useState<string | null>(null);
  const [note, setNote] = useState('');

  const advance = async (assignment: Assignment, status: AssignmentUpdate) => {
    setBusy(assignment.id);
    setFailure(null);
    try {
      const res = await fetch(`/api/org/assignments/${encodeURIComponent(assignment.id)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, ...(note.trim() ? { note: note.trim() } : {}) }),
      });
      const raw = await res.text();
      let answer: { error?: string } | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as { error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok) {
        setFailure({
          id: assignment.id,
          message: answer?.error ?? `That could not be updated — the service answered ${res.status}.`,
        });
        return;
      }
      setRows((prev) =>
        prev.map((row) =>
          row.id === assignment.id
            ? {
                ...row,
                status,
                statusRaw: status,
                note: note.trim() || row.note,
                updatedAtIso: new Date().toISOString(),
              }
            : row,
        ),
      );
      setClosing(null);
      setNote('');
      router.refresh();
    } catch {
      setFailure({ id: assignment.id, message: 'The console could not reach its own server.' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Table
      empty="Nobody has been dispatched yet. Assignments appear here when a report is given to a member of staff."
      columns={['Report', 'Assigned to', 'Status', 'Updated', '']}
      rows={rows.map((assignment) => {
        const next = nextStatus(assignment.status);
        const isClosing = closing === assignment.id;
        return [
          <div key="r" className="min-w-0">
            <code className="text-xs">{assignment.incidentId || '—'}</code>
            {assignment.note ? (
              <p className="mt-0.5 max-w-[18rem] text-2xs leading-relaxed text-text-muted">
                {assignment.note}
              </p>
            ) : null}
          </div>,
          <span key="a" className="text-xs font-medium text-text-primary">
            {assignment.assigneeName}
          </span>,
          <Pill
            key="s"
            tone={
              assignment.status === 'closed'
                ? 'good'
                : assignment.status === 'on_scene' || assignment.status === 'en_route'
                  ? 'info'
                  : assignment.status === null
                    ? 'neutral'
                    : 'warn'
            }
          >
            {assignment.status ? ASSIGNMENT_LABEL[assignment.status] : assignment.statusRaw}
          </Pill>,
          <span key="u" className="text-xs text-text-muted">
            {formatRelativeTime(assignment.updatedAtIso ?? assignment.createdAtIso) ?? '—'}
          </span>,
          <div key="x" className="flex flex-col items-end gap-1.5">
            {next === null ? null : isClosing ? (
              <>
                <input
                  aria-label="What was found"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  maxLength={500}
                  placeholder="What was found (optional)"
                  className="h-8 w-56 rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-xs"
                />
                <span className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy !== null}
                    onClick={() => {
                      setClosing(null);
                      setNote('');
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    loading={busy === assignment.id}
                    onClick={() => void advance(assignment, 'closed')}
                  >
                    Close assignment
                  </Button>
                </span>
              </>
            ) : (
              <Button
                size="sm"
                variant={next === 'closed' ? 'secondary' : 'primary'}
                loading={busy === assignment.id}
                disabled={busy !== null && busy !== assignment.id}
                onClick={() => {
                  if (next === 'closed') {
                    setClosing(assignment.id);
                    setNote('');
                    return;
                  }
                  void advance(assignment, next);
                }}
              >
                {ADVANCE_LABEL[next]}
              </Button>
            )}
            {failure?.id === assignment.id ? (
              <p role="alert" className="max-w-[16rem] text-right text-2xs text-danger">
                {failure.message}
              </p>
            ) : null}
          </div>,
        ];
      })}
      align={[4]}
    />
  );
}
