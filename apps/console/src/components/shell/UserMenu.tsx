'use client';

import { useRouter } from 'next/navigation';
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
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
    router.refresh();
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
        title="Sign out"
        className="flex h-7 w-7 items-center justify-center rounded-xs text-text-faint transition hover:bg-danger-wash hover:text-danger disabled:opacity-50"
      >
        <LogOut className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
