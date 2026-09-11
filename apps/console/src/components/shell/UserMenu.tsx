'use client';

import { useState } from 'react';
import { LogOut } from 'lucide-react';
import type { SessionUser } from '@/lib/token';

/**
 * Signed-in identity and the way out.
 *
 * Sign-out is a POST, so it cannot be triggered by a prefetch or an image tag
 * on some other page. It is visible rather than buried in a menu because
 * shared office workstations are normal for these organisations, and someone
 * who cannot find sign-out simply stays signed in.
 */
export function UserMenu({ user }: { user: SessionUser }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  /**
   * Sign out.
   *
   * A full page load rather than a client navigation, and deliberately so.
   *
   * `router.replace('/login')` followed by `router.refresh()` had two problems.
   * `refresh()` re-fetches whichever route is *current*, and the replace has
   * not necessarily committed when it runs — so it could re-request the page
   * being left, with the session cookie already gone, in the middle of the
   * transition. Worse, Next's client router keeps a cache of rendered segments:
   * a soft navigation leaves the outgoing operator's inbox, payouts and queue
   * sitting in memory, and the back button can put them back on screen after
   * sign-out. `location.assign` discards all of it.
   *
   * And the session is only treated as ended if the server says it is. Clearing
   * the screen while the cookie survives is the one outcome a sign-out button
   * must never produce — on a shared machine, the next person is still signed
   * in as a platform owner.
   */
  const signOut = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) {
        setFailed(true);
        setBusy(false);
        return;
      }
      window.location.assign('/login');
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  const initials = user.displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-pill bg-gradient-to-br from-accent to-accent-alt text-2xs font-semibold text-text-on-dark"
      >
        {initials}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium">{user.displayName}</span>
        <span className="block truncate text-2xs text-text-faint">
          {user.businessName ?? user.title ?? user.email}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void signOut()}
        disabled={busy}
        aria-label="Sign out"
        title={failed ? 'Sign out failed — try again' : 'Sign out'}
        className={
          failed
            ? 'flex h-7 w-7 items-center justify-center rounded-xs bg-danger-wash text-danger transition'
            : 'flex h-7 w-7 items-center justify-center rounded-xs text-text-faint transition hover:bg-danger-wash hover:text-danger disabled:opacity-50'
        }
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
      {/*
        Said out loud, not left to the icon.

        A sign-out that silently did nothing is the one failure here with a real
        cost: somebody walks away from a shared machine believing they are
        signed out while a platform-owner session is still live in the browser.
      */}
      {failed ? (
        <p role="alert" className="w-full text-2xs leading-relaxed text-danger">
          You are still signed in — that did not go through. Try again.
        </p>
      ) : null}
    </div>
  );
}
