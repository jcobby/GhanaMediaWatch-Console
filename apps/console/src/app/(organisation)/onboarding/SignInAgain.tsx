'use client';

import { useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui';

/**
 * Sign out, then open the sign-in page.
 *
 * An approved organisation's session still says onboarding is incomplete — it
 * was minted before the approval — so middleware keeps it on this page. A fresh
 * sign-in reads `/me`, finds the organisation verified, and opens the console.
 * A plain link to `/login` would bounce straight back here, because a signed-in
 * visitor to `/login` is sent to their home.
 */
export function SignInAgain() {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const go = async () => {
    setBusy(true);
    setFailed(false);
    try {
      const res = await fetch('/api/auth/logout', { method: 'POST' });
      if (!res.ok) throw new Error(String(res.status));
      window.location.assign('/login');
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <div className="mt-5 flex flex-col items-start gap-2">
      <Button size="lg" loading={busy} onClick={() => void go()}>
        Sign in again <ArrowRight className="h-3.5 w-3.5" />
      </Button>
      {failed ? (
        <p role="alert" className="text-xs text-danger">
          You could not be signed out. Use the menu at the bottom of the sidebar instead.
        </p>
      ) : null}
    </div>
  );
}
