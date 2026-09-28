'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Check, AlertCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Saying that something worked.
 *
 * **The console said nothing on success.** Every consequential action here —
 * approving an organisation, licensing a report, releasing a payout — did its
 * work, called `router.refresh()`, and left the operator looking at a page
 * where the thing they had acted on was simply *gone*. A failure at least
 * produced an inline message; a success produced silence, which reads exactly
 * like a click that missed.
 *
 * That is worse in this console than in most, because the actions are
 * irreversible and expensive. An approval grants an organisation access to
 * footage of the public; a licence charges money and pays a reporter. An
 * operator who cannot tell whether it went through will do it again.
 *
 * Deliberately small: a queue of messages, four seconds each, dismissable, and
 * no dependency. A toast library would be a bundle and a set of opinions for
 * something that is twenty lines of state.
 */

export interface ToastMessage {
  id: number;
  tone: 'success' | 'error';
  title: string;
  body?: string;
}

interface ToastApi {
  /** Something worked. Say what, specifically — "Approved" alone is not an answer. */
  success: (title: string, body?: string) => void;
  /** Something did not. The service's own words where there are any. */
  error: (title: string, body?: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

/** How long a message stays. Long enough to read twice, short enough not to nag. */
const DWELL_MS = 4500;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  const push = useCallback((tone: ToastMessage['tone'], title: string, body?: string) => {
    setMessages((prev) => [
      ...prev,
      { id: Date.now() + Math.random(), tone, title, ...(body ? { body } : {}) },
    ]);
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      success: (title, body) => push('success', title, body),
      error: (title, body) => push('error', title, body),
    }),
    [push],
  );

  const dismiss = useCallback((id: number) => {
    setMessages((prev) => prev.filter((m) => m.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={api}>
      {children}
      {/*
        `aria-live="polite"`, so the operator running this with a screen reader
        hears the confirmation rather than only seeing it. `role="status"` on
        each message, because a success is not an alert.
      */}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2"
      >
        {messages.map((message) => (
          <Toast key={message.id} message={message} onDismiss={() => dismiss(message.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function Toast({ message, onDismiss }: { message: ToastMessage; onDismiss: () => void }) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, DWELL_MS);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  const good = message.tone === 'success';

  return (
    <div
      role="status"
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-sm border px-3.5 py-3 shadow-lg',
        good ? 'border-success/25 bg-success-wash' : 'border-danger/25 bg-danger-wash',
      )}
    >
      {good ? (
        <Check className="mt-px h-4 w-4 shrink-0 text-success" strokeWidth={2.2} />
      ) : (
        <AlertCircle className="mt-px h-4 w-4 shrink-0 text-danger" strokeWidth={2.2} />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold">{message.title}</p>
        {message.body ? (
          <p className="mt-0.5 text-2xs leading-relaxed text-text-secondary">{message.body}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        aria-label="Dismiss"
        className="shrink-0 text-text-faint transition hover:text-text-primary"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/**
 * Never throws when there is no provider.
 *
 * A component that says "licensed" is not worth crashing a page over, and these
 * are rendered in enough places that a missing provider should degrade to
 * silence rather than to a blank screen.
 */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  return api ?? { success: () => undefined, error: () => undefined };
}
