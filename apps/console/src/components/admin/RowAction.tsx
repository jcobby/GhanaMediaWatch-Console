'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * A decision taken on one row.
 *
 * **Simulated.** Nothing is persisted — there is no backend to write to, so
 * the row settles into its new state and returns to the seeded one on reload.
 * The page says so once, rather than each control disclaiming itself.
 *
 * The delay is not decoration. Approving an institution or releasing a payout
 * is a server round trip in the real system, and a control that resolves
 * instantly teaches the wrong expectation about what these buttons cost.
 */
export function RowAction({
  label,
  done,
  tone = 'default',
  confirm,
  disabled,
  disabledReason,
}: {
  label: string;
  /** What the control says once the action has been taken. */
  done: string;
  tone?: 'default' | 'primary' | 'danger';
  /** Shown before acting. For anything that would be hard to walk back. */
  confirm?: string;
  disabled?: boolean;
  /** Why it is disabled — shown on hover rather than left to guesswork. */
  disabledReason?: string;
}) {
  const [state, setState] = useState<'idle' | 'confirming' | 'working' | 'done'>('idle');

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-2xs font-medium text-success">
        <Check className="h-3 w-3" strokeWidth={2.5} />
        {done}
      </span>
    );
  }

  if (state === 'confirming') {
    return (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        <span className="text-2xs text-text-muted">{confirm}</span>
        <button
          type="button"
          onClick={() => {
            setState('working');
            setTimeout(() => setState('done'), 900);
          }}
          className="rounded-xs px-1.5 py-0.5 text-2xs font-semibold text-danger hover:bg-danger-wash"
        >
          Yes
        </button>
        <button
          type="button"
          onClick={() => setState('idle')}
          className="rounded-xs px-1.5 py-0.5 text-2xs text-text-muted hover:bg-canvas-raise"
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={disabled || state === 'working'}
      title={disabled ? disabledReason : undefined}
      onClick={() => {
        if (confirm) {
          setState('confirming');
          return;
        }
        setState('working');
        setTimeout(() => setState('done'), 900);
      }}
      className={cn(
        'inline-flex items-center gap-1 whitespace-nowrap rounded-sm border px-2.5 py-1 text-2xs font-medium transition',
        disabled && 'cursor-not-allowed border-hairline/10 text-text-faint/60',
        !disabled &&
          tone === 'default' &&
          'border-hairline/15 text-text-secondary hover:border-accent/40 hover:text-accent',
        !disabled &&
          tone === 'primary' &&
          'border-accent bg-accent text-text-on-dark hover:opacity-90',
        !disabled && tone === 'danger' && 'border-danger/30 text-danger hover:bg-danger-wash',
      )}
    >
      {state === 'working' ? <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2.5} /> : null}
      {state === 'working' ? 'Working…' : label}
    </button>
  );
}

/** Two or three actions on one row, kept from wrapping. */
export function RowActions({ children }: { children: React.ReactNode }) {
  return <span className="flex items-center justify-end gap-1.5">{children}</span>;
}
