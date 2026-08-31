'use client';

import { Check, Upload, X } from 'lucide-react';
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
 */
export function DocumentSlot({
  id,
  uploaded,
  satisfiedByAlternative,
  onUpload,
  onRemove,
}: {
  id: DocumentId;
  uploaded: UploadedDocument | null;
  /** Something else in the same group already covers this. */
  satisfiedByAlternative?: boolean;
  onUpload: (fileName: string) => void;
  onRemove: () => void;
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
        {done ? (
          <Check className="h-3.5 w-3.5" strokeWidth={3} />
        ) : (
          <Upload className="h-3.5 w-3.5" />
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium">{requirement.label}</p>
        {done ? (
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
        <label className="shrink-0 cursor-pointer rounded-sm border border-hairline/12 px-2.5 py-1 text-2xs font-medium transition hover:border-accent/30 hover:text-accent">
          Upload
          <input
            type="file"
            className="sr-only"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file.name);
              // Reset so choosing the same file twice still fires.
              e.target.value = '';
            }}
          />
        </label>
      )}
    </div>
  );
}
