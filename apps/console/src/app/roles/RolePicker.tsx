'use client';

import { useState } from 'react';
import { ArrowRight, Lock } from 'lucide-react';
import {
  MODULE_META,
  VISIBLE_MODULES,
  ROLE_META,
  isReadOnly,
  navigationFor,
  rolesInModule,
  type PlatformModule,
  type PlatformRole,
} from '@dawuro/core';
import { cn } from '@/lib/cn';

/**
 * Choosing which role to sign in as.
 *
 * This exists because the product has twenty roles and a demo has one person.
 * In production nobody picks their own role — it comes from the account — so
 * this screen is explicitly labelled as a simulation rather than dressed up as
 * a feature.
 *
 * The two modules are tabs rather than one long list because the split is the
 * most important thing about the role model: admin roles see across every
 * institution, service roles see one. A flat list of twenty would bury that.
 */
export function RolePicker() {
  const [module, setModule] = useState<PlatformModule>(VISIBLE_MODULES[0] ?? 'admin');

  // A tab strip with one tab is chrome that explains nothing. When only one
  // module is on offer, its heading carries the description instead.
  const showTabs = VISIBLE_MODULES.length > 1;
  const [pending, setPending] = useState<PlatformRole | null>(null);

  const enter = async (role: PlatformRole) => {
    setPending(role);
    const res = await fetch('/api/auth/assume-role', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role }),
    });

    const body = (await res.json()) as { redirectTo?: string; error?: string };
    if (!res.ok) {
      setPending(null);
      return;
    }
    // A full navigation, so the new session cookie is carried on every request
    // from here rather than racing the router's cached payloads.
    window.location.assign(body.redirectTo ?? ROLE_META[role].home);
  };

  return (
    <div className="space-y-4">
      {/* ── Module tabs ─────────────────────────────────────────────────── */}
      {showTabs ? (
        <div
          role="tablist"
          aria-label="Module"
          className="grid grid-cols-1 gap-2 rounded-lg bg-canvas-raise/60 p-2 sm:grid-cols-2"
        >
          {VISIBLE_MODULES.map((id) => {
            const meta = MODULE_META[id];
            const on = module === id;
            return (
              <button
                key={id}
                role="tab"
                aria-selected={on}
                onClick={() => setModule(id)}
                className={cn(
                  'rounded-md px-4 py-3 text-left transition',
                  on
                    ? 'bg-accent text-text-on-dark shadow-sm'
                    : 'text-text-muted hover:bg-canvas-soft/60',
                )}
              >
                <span className="flex items-baseline gap-2">
                  <span className="text-sm font-semibold">{meta.label}</span>
                  <span className={cn('tabular text-xs', on ? 'opacity-75' : 'text-text-faint')}>
                    {rolesInModule(id).length}
                  </span>
                </span>
                <span className={cn('mt-0.5 block text-xs', on ? 'opacity-85' : 'text-text-faint')}>
                  {meta.blurb}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="rounded-lg bg-canvas-raise/60 px-4 py-3">
          <p className="text-sm font-semibold text-text-primary">{MODULE_META[module].label}</p>
          <p className="mt-0.5 text-xs text-text-muted">{MODULE_META[module].blurb}</p>
        </div>
      )}

      {/* ── Roles ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {rolesInModule(module).map((role) => {
          const meta = ROLE_META[role];
          const busy = pending === role;
          const destinations = navigationFor(role).reduce(
            (n, section) => n + section.items.length,
            0,
          );

          return (
            <button
              key={role}
              onClick={() => void enter(role)}
              disabled={pending !== null}
              className={cn(
                'group relative overflow-hidden rounded-md border border-hairline/10 bg-canvas-soft',
                'p-4 text-left transition hover:border-accent/40 hover:shadow-sm',
                'disabled:opacity-60',
                busy && 'border-accent',
              )}
            >
              {/* The role's own hue, so no two cards read identically. */}
              <span
                aria-hidden
                className="absolute inset-y-0 left-0 w-1"
                style={{ backgroundColor: meta.hue }}
              />

              <span className="flex items-start justify-between gap-3 pl-2">
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-text-primary">{meta.label}</span>
                    {isReadOnly(role) ? (
                      <span
                        title="Reads everything, changes nothing"
                        className="flex items-center gap-1 rounded-pill bg-canvas-raise px-1.5 py-0.5 text-2xs text-text-muted"
                      >
                        <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
                        read-only
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-1 block text-xs leading-relaxed text-text-muted">
                    {meta.blurb}
                  </span>
                  <span className="mt-2 block text-2xs text-text-faint">
                    {meta.mobileOnly
                      ? 'No console — the phone is the product'
                      : `${destinations} ${destinations === 1 ? 'destination' : 'destinations'}`}
                  </span>
                </span>

                <ArrowRight
                  className="mt-0.5 h-4 w-4 shrink-0 text-text-faint transition group-hover:translate-x-0.5 group-hover:text-accent"
                  strokeWidth={2}
                />
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
