'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Building2, ShieldCheck } from 'lucide-react';
import { Button, Field } from '@/components/ui';
import { cn } from '@/lib/cn';

interface DemoAccount {
  email: string;
  displayName: string;
  accountType: 'business' | 'platform_owner' | 'reporter';
  showcases: string;
}

/**
 * The sign-in form.
 *
 * The access-code field is revealed rather than always shown: most people
 * signing in are business users who do not have one, and a permanently visible
 * field they must ignore makes the form look harder than it is. The server
 * tells us when it is needed.
 */
export function LoginForm({
  demoAccounts,
  demoPassword,
}: {
  demoAccounts: DemoAccount[];
  demoPassword: string;
}) {
  const params = useSearchParams();
  const [pending, setPending] = useState(false);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [needsCode, setNeedsCode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setPending(true);

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        password,
        ...(accessCode ? { accessCode } : {}),
      }),
    });

    const body = (await res.json()) as {
      error?: string;
      needsAccessCode?: boolean;
      redirectTo?: string;
    };

    if (!res.ok) {
      setError(body.error ?? 'Sign-in failed.');
      if (body.needsAccessCode) setNeedsCode(true);
      setPending(false);
      return;
    }

    // `next` is a path from middleware, never a full URL — a redirect
    // parameter that accepts arbitrary URLs is an open redirect.
    const requested = params.get('next');
    const safeNext = requested?.startsWith('/') && !requested.startsWith('//') ? requested : null;

    /*
     * A full navigation, not a client-side route change.
     *
     * The session cookie was just set by the server response, and the App
     * Router's cached RSC payloads were fetched without it. Replacing plus
     * refreshing inside a transition left the transition pending forever — the
     * button spun and nothing moved. A document navigation guarantees every
     * request from here carries the new session and nothing stale survives,
     * which is what you want crossing an auth boundary anyway.
     */
    window.location.assign(safeNext ?? body.redirectTo ?? '/');
  };

  const fill = (account: DemoAccount) => {
    setEmail(account.email);
    setPassword(demoPassword);
    setAccessCode(account.accountType === 'platform_owner' ? 'DAWURO-2026' : '');
    setNeedsCode(account.accountType === 'platform_owner');
    setError(null);
  };

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field
          label="Email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@organisation.gh"
          required
        />
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        {needsCode ? (
          <Field
            label="Access code"
            value={accessCode}
            onChange={(e) => setAccessCode(e.target.value)}
            hint="Platform operators are issued this separately."
            autoComplete="one-time-code"
          />
        ) : null}

        {error ? (
          <div role="alert" className="rounded-sm bg-danger-wash px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}

        <Button type="submit" size="lg" fullWidth loading={pending}>
          Sign in
        </Button>
      </form>

      {/* Seeded accounts — removed when the backend replaces the fixtures. */}
      <div className="space-y-2.5">
        <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
          Demo accounts
        </p>
        <div className="space-y-1.5">
          {demoAccounts.map((account) => {
            const isOperator = account.accountType === 'platform_owner';
            return (
              <button
                key={account.email}
                type="button"
                onClick={() => fill(account)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-sm border border-hairline/[0.08] px-3 py-2.5 text-left transition',
                  'hover:border-accent/30 hover:bg-accent-wash/40',
                )}
              >
                <span
                  className={cn(
                    'flex h-7 w-7 shrink-0 items-center justify-center rounded-xs',
                    isOperator ? 'bg-accent-wash text-accent' : 'bg-canvas-raise text-text-muted',
                  )}
                >
                  {isOperator ? (
                    <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                  ) : (
                    <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{account.displayName}</span>
                  <span className="block truncate text-2xs text-text-faint">
                    {account.showcases}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
        <p className="text-2xs text-text-faint">
          Password for all demo accounts: <span className="font-mono">{demoPassword}</span>
        </p>
      </div>
    </div>
  );
}
