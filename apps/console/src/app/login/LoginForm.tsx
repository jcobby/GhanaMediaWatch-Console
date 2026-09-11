'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Building2, ChevronDown, ScanEye, ShieldCheck } from 'lucide-react';
import { Button, Field } from '@/components/ui';
import { cn } from '@/lib/cn';

interface DemoAccount {
  email: string;
  displayName: string;
  accountType: 'organisation' | 'platform_owner' | 'editor' | 'reporter';
  showcases: string;
  /** The role's own label, when this account exists to demonstrate one. */
  roleLabel?: string;
}

export interface DemoGroup {
  title: string;
  /** One line under the heading, saying what this set of accounts is for. */
  blurb?: string;
  accounts: DemoAccount[];
  /** Collapsed by default — twenty roles listed flat would bury the form. */
  collapsible?: boolean;
}

/**
 * The sign-in form.
 *
 * The access-code field is revealed rather than always shown: most people
 * signing in are organisation users who do not have one, and a permanently visible
 * field they must ignore makes the form look harder than it is. The server
 * tells us when it is needed.
 */
export function LoginForm({ groups, demoPassword }: { groups: DemoGroup[]; demoPassword: string }) {
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

        {/*
          Why they are back here.

          Being bounced to a login screen with no explanation reads as the app
          having lost their work. This one is specifically the case where the
          session could not be renewed — they did nothing wrong and nothing was
          lost, and saying so is the difference between "sign in again" and
          "something is broken".
        */}
        {!error && params.get('reason') === 'expired' ? (
          <div className="rounded-sm bg-canvas-raise px-3 py-2 text-xs leading-relaxed text-text-muted">
            Your session expired, so you were signed out. Nothing has been lost — sign in to pick up
            where you left off.
          </div>
        ) : null}

        {error ? (
          <div role="alert" className="rounded-sm bg-danger-wash px-3 py-2 text-xs text-danger">
            {error}
          </div>
        ) : null}

        <Button type="submit" size="lg" fullWidth loading={pending}>
          Sign in
        </Button>

        {/* Registration sits under the button, not above the form. Someone
            arriving here is far more often signing in than joining, and a
            call to register placed before the fields reads as a wall in front
            of the thing they came to do. */}
        <div className="flex items-center gap-3 pt-1">
          <span className="h-px flex-1 bg-hairline/10" aria-hidden />
          <span className="text-2xs uppercase tracking-wider text-text-faint">or</span>
          <span className="h-px flex-1 bg-hairline/10" aria-hidden />
        </div>

        <Link
          href="/register"
          className="flex w-full items-center justify-center rounded-sm border border-hairline/15 px-4 py-2.5 text-sm font-medium text-text-primary transition hover:border-accent/40 hover:bg-accent-wash/40 hover:text-accent"
        >
          Register
        </Link>
      </form>

      {/* Seeded accounts — removed when the backend replaces the fixtures. */}
      <div className="space-y-4">
        {groups.map((group) =>
          group.collapsible ? (
            <details key={group.title} className="group/d">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-2 py-1">
                <span>
                  <span className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                    {group.title}
                  </span>
                  <span className="tabular ml-1.5 text-2xs text-text-faint">
                    {group.accounts.length}
                  </span>
                </span>
                <ChevronDown
                  className="h-3.5 w-3.5 text-text-faint transition group-open/d:rotate-180"
                  strokeWidth={2}
                />
              </summary>
              {group.blurb ? (
                <p className="pb-1.5 text-2xs leading-relaxed text-text-faint">{group.blurb}</p>
              ) : null}
              <div className="space-y-1">
                {group.accounts.map((account) => (
                  <RoleRow key={account.email} account={account} onPick={fill} />
                ))}
              </div>
            </details>
          ) : (
            <div key={group.title} className="space-y-2.5">
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                {group.title}
              </p>
              <div className="space-y-1.5">
                {group.accounts.map((account) => {
                  const isOperator = account.accountType === 'platform_owner';
                  const isEditor = account.accountType === 'editor';
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
                          isOperator || isEditor
                            ? 'bg-accent-wash text-accent'
                            : 'bg-canvas-raise text-text-muted',
                        )}
                      >
                        {isEditor ? (
                          <ScanEye className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : isOperator ? (
                          <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <Building2 className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {account.displayName}
                        </span>
                        <span className="block truncate text-2xs text-text-faint">
                          {account.showcases}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ),
        )}

        {/*
          These no longer sign anybody in.

          Sign-in goes to the live backend now, and none of these seeded
          addresses exist there — so a click prefills the form and the server
          rejects it. The list is kept because it is the clearest statement of
          what roles the console has, and picking one still shows you which
          shell you would land in. Saying so is the difference between a
          reference list and a dead end somebody spends ten minutes on.
        */}
        <p className="text-2xs leading-relaxed text-text-faint">
          These are the roles the console supports, not working logins. Sign-in is checked against
          the live service, where these seeded accounts do not exist — ask an administrator to
          create yours. The old shared password <span className="font-mono">{demoPassword}</span> is
          no longer accepted.
        </p>
      </div>
    </div>
  );
}

/**
 * One role account, compact.
 *
 * The rich two-line treatment above suits five narrative accounts and buries
 * twenty. Here the role label is the heading and the person's name is the
 * detail, because when you are hunting for "Compliance Officer" the name is
 * not what you are scanning for.
 */
function RoleRow({
  account,
  onPick,
}: {
  account: DemoAccount;
  onPick: (account: DemoAccount) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(account)}
      className="flex w-full items-baseline gap-2 rounded-xs px-2 py-1.5 text-left transition hover:bg-accent-wash/40"
    >
      <span className="min-w-0 flex-1 truncate text-xs font-medium text-text-primary">
        {account.roleLabel ?? account.displayName}
      </span>
      <span className="shrink-0 truncate text-2xs text-text-faint">{account.displayName}</span>
    </button>
  );
}
