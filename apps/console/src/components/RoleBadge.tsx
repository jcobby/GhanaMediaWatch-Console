import Link from 'next/link';
import { Lock, Repeat } from 'lucide-react';
import { MODULE_META, ROLE_META, isReadOnly, type PlatformRole } from '@dawuro/core';

/**
 * A strip naming who you are currently signed in as.
 *
 * Its real job is the demo: switching between twenty roles is disorienting
 * without a persistent answer to "which one am I?" on screen. It also carries
 * the read-only marker, so an auditor understands why a control is missing
 * rather than assuming the page is broken.
 */
export function RoleBadge({ role, name }: { role: PlatformRole; name: string }) {
  const meta = ROLE_META[role];
  const readOnly = isReadOnly(role);

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-hairline/[0.07] bg-canvas-soft/70 px-5 py-2">
      <span
        aria-hidden
        className="h-5 w-1 shrink-0 rounded-pill"
        style={{ backgroundColor: meta.hue }}
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-xs">
          <span className="font-semibold text-text-primary">{name}</span>
          <span className="text-text-faint"> · </span>
          <span className="text-text-secondary">{meta.label}</span>
          <span className="text-text-faint"> · {MODULE_META[meta.module].label}</span>
        </p>
      </div>

      {readOnly ? (
        <span className="flex shrink-0 items-center gap-1 rounded-pill bg-canvas-raise px-2 py-0.5 text-2xs font-medium text-text-muted">
          <Lock className="h-2.5 w-2.5" strokeWidth={2.5} />
          Read-only
        </span>
      ) : null}

      <Link
        href="/roles"
        className="flex shrink-0 items-center gap-1 rounded-pill px-2 py-0.5 text-2xs text-text-muted transition hover:bg-canvas-raise hover:text-text-primary"
      >
        <Repeat className="h-2.5 w-2.5" strokeWidth={2.5} />
        Switch role
      </Link>
    </div>
  );
}
