'use client';

import { Check, Loader2, Upload, X } from 'lucide-react';
import { DOCUMENT_REQUIREMENTS, type DocumentId, type UploadedDocument } from '@dawuro/core';
import { cn } from '@/lib/cn';

/**
 * One document an application needs.
 *
 * Attached files show their name rather than a tick alone — an applicant who
 * uploaded the wrong PDF three steps ago needs to be able to see that without
 * downloading it again.
 *
 * Alternatives are stated on the slot itself: "either one satisfies this".
 * Without saying so, people attach both to be safe, and an application that
 * asks for paperwork it does not need is one that stalls.
 *
 * **The file is handed over, not its name.** This used to call
 * `onUpload(file.name)` and drop the `File` on the floor, so a certificate of
 * incorporation was recorded as the string "cert.pdf" and the bytes were never
 * sent anywhere. A reviewer approving on that is approving a filename. These
 * documents decide whether an organisation gets access to footage of the
 * public, so they are either stored or not asked for.
 */
export function DocumentSlot({
  id,
  uploaded,
  satisfiedByAlternative,
  onUpload,
  onRemove,
  busy = false,
  error = null,
}: {
  id: DocumentId;
  uploaded: UploadedDocument | null;
  /** Something else in the same group already covers this. */
  satisfiedByAlternative?: boolean;
  onUpload: (file: File) => void;
  onRemove: () => void;
  /** An upload in flight for this slot. */
  busy?: boolean;
  /** Why the last attempt failed, shown on the slot that failed. */
  error?: string | null;
}) {
  const requirement = DOCUMENT_REQUIREMENTS[id];
  const done = uploaded !== null;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-sm border p-3 transition',
        done
          ? 'border-success/25 bg-success-wash/25'
          : satisfiedByAlternative
            ? 'border-hairline/[0.07] opacity-60'
            : 'border-dashed border-hairline/20',
      )}
    >
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-xs',
          done ? 'bg-success text-text-on-dark' : 'bg-canvas-raise text-text-faint',
        )}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : done ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{requirement.label}</p>
        {/* The failure sits on the slot that failed. A single banner at the top
            of a form with five slots does not say which one to try again. */}
        {error ? (
          <p className="text-2xs leading-relaxed text-danger">{error}</p>
        ) : busy ? (
          <p className="truncate text-2xs text-text-faint">Uploading…</p>
        ) : done ? (
          <p className="truncate text-2xs text-text-muted">{uploaded.fileName}</p>
        ) : (
          <p className="truncate text-2xs text-text-faint">
            {satisfiedByAlternative ? 'Already covered by another document.' : requirement.hint}
          </p>
        )}
      </div>

      {done ? (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${requirement.label}`}
          className="shrink-0 rounded-xs p-1.5 text-text-faint transition hover:bg-canvas-raise hover:text-danger"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      ) : (
        <label
          className={cn(
            'shrink-0 rounded-sm border border-hairline/12 px-2.5 py-1 text-2xs font-medium transition',
            busy
              ? 'cursor-not-allowed opacity-50'
              : 'cursor-pointer hover:border-accent/30 hover:text-accent',
          )}
        >
          {busy ? 'Uploading' : 'Upload'}
          <input
            type="file"
            className="sr-only"
            disabled={busy}
            accept=".pdf,image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              // The file itself. Passing `file.name` here was the whole bug.
              if (file) onUpload(file);
              // Reset so choosing the same file twice still fires.
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
