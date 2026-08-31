'use client';

import { useState } from 'react';

/**
 * Sign in with Google.
 *
 * Placed but not connected. Real OAuth needs a Google Cloud project, a client
 * id and secret, and a registered redirect URI — none of which can be invented
 * here, and a button that silently does nothing is worse than one that says so.
 *
 * When the credentials exist, this becomes a link to a route handler that
 * starts the OAuth flow; the rest of the app already models the outcome, since
 * `MembershipRequest` carries `signUpMethod` and `emailVerified` and the Team
 * screen renders both.
 */
export function GoogleButton({ label = 'Continue with Google' }: { label?: string }) {
  const [clicked, setClicked] = useState(false);

  return (
    <div>
      <button
        type="button"
        onClick={() => setClicked(true)}
        className="flex h-10 w-full items-center justify-center gap-2.5 rounded-sm border border-hairline/15 bg-canvas-soft text-sm font-medium transition hover:bg-canvas-raise/60"
      >
        <GoogleMark />
        {label}
      </button>
      {clicked ? (
        <p role="status" className="mt-2 text-center text-2xs text-text-muted">
          Google sign-in is not connected yet. Use the form below for now.
        </p>
      ) : null}
    </div>
  );
}

/** The official four-colour mark, inlined so no external asset is required. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-4 w-4" aria-hidden focusable="false">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
