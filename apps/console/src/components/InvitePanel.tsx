'use client';

import { useState } from 'react';
import { Check, Copy, Link2, Plus, Users, Briefcase, Building2, Ban } from 'lucide-react';
import {
  formatRelativeTime,
  inviteProblem,
  remainingUses,
  type Invite,
  type InviteKind,
} from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { cn } from '@/lib/cn';

const KIND: Record<InviteKind, { label: string; blurb: string; icon: typeof Users }> = {
  employee: {
    label: 'Employee',
    blurb: 'Staff of your organisation. They appear in your team list.',
    icon: Users,
  },
  agent: {
    label: 'Agent',
    blurb: 'Works on your behalf without being employed by you.',
    icon: Briefcase,
  },
  affiliate_org: {
    label: 'Another organisation',
    blurb: 'Registers in its own right and links to yours.',
    icon: Building2,
  },
};

const PROBLEM_LABEL = {
  revoked: 'Revoked',
  expired: 'Expired',
  exhausted: 'All used',
} as const;

/**
 * Invite links an organisation hands out.
 *
 * Three kinds, because they produce three different things: an employee joins
 * your team, an agent acts for you without being staff, and an affiliate
 * organisation registers separately and links to you.
 *
 * A link never grants anything by itself. It pre-fills a request that someone
 * inside still accepts — which is why the preset role shown on each link is the
 * least privileged one. An invite that pre-granted admin would be a link that
 * grants admin to whoever it was forwarded to.
 */
export function InvitePanel({ invites, baseUrl }: { invites: Invite[]; baseUrl: string }) {
  const [creating, setCreating] = useState<InviteKind | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [revoked, setRevoked] = useState<Set<string>>(new Set());

  const now = new Date().toISOString();

  const copy = async (token: string) => {
    const url = `${baseUrl}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(token);
      window.setTimeout(() => setCopied((c) => (c === token ? null : c)), 1800);
    } catch {
      // Clipboard access can be refused; the link is visible either way.
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(KIND) as InviteKind[]).map((kind) => {
          const meta = KIND[kind];
          const Icon = meta.icon;
          const active = creating === kind;
          return (
            <button
              key={kind}
              type="button"
              onClick={() => setCreating(active ? null : kind)}
              aria-pressed={active}
              className={cn(
                'rounded-md border p-3.5 text-left transition',
                active
                  ? 'border-accent bg-accent-wash/40'
                  : 'border-hairline/[0.10] hover:border-accent/30 hover:bg-canvas-raise/40',
              )}
            >
              <span className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', active ? 'text-accent' : 'text-text-muted')} />
                <span className="text-sm font-medium">{meta.label}</span>
              </span>
              <span className="mt-1 block text-2xs leading-relaxed text-text-muted">
                {meta.blurb}
              </span>
            </button>
          );
        })}
      </div>

      {creating ? (
        <Panel className="flex items-start gap-3 border-accent/25 bg-accent-wash/25 p-4">
          <Plus className="mt-0.5 h-4 w-4 shrink-0 text-accent" strokeWidth={2.2} />
          <div className="flex-1 text-xs leading-relaxed">
            <p className="font-medium">New {KIND[creating].label.toLowerCase()} link</p>
            <p className="mt-0.5 text-text-muted">
              Created with the lowest permissions and no duties. Set those after they join —
              deciding in advance means whoever the link reaches inherits them.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={() => setCreating(null)}>
                <Link2 className="h-3.5 w-3.5" /> Create link
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setCreating(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Panel>
      ) : null}

      <div className="space-y-1.5">
        {invites.length === 0 ? (
          <Panel className="p-8 text-center">
            <p className="text-sm">No links yet</p>
            <p className="mt-1 text-xs text-text-muted">
              Create one to bring your team onto Dawuro.
            </p>
          </Panel>
        ) : (
          invites.map((invite) => {
            const isRevoked = revoked.has(invite.token);
            const problem = isRevoked ? 'revoked' : inviteProblem(invite, now);
            const left = remainingUses(invite);
            const Icon = KIND[invite.kind].icon;

            return (
              <Panel key={invite.token} className={cn('p-3.5', problem && 'opacity-70')}>
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-sm bg-canvas-raise">
                    <Icon className="h-3.5 w-3.5 text-text-muted" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium">{KIND[invite.kind].label}</p>
                      {problem ? (
                        <Badge tone="neutral">{PROBLEM_LABEL[problem]}</Badge>
                      ) : (
                        <Badge tone="success">Live</Badge>
                      )}
                      <span className="text-2xs text-text-faint">
                        {invite.usedCount} used
                        {left !== null ? ` · ${left} left` : ' · unlimited'}
                      </span>
                    </div>
                    {invite.note ? (
                      <p className="mt-0.5 truncate text-xs text-text-muted">{invite.note}</p>
                    ) : null}
                    <p className="mt-1.5 truncate rounded-xs bg-canvas-raise px-2 py-1 font-mono text-2xs text-text-muted">
                      {baseUrl}/invite/{invite.token}
                    </p>
                    <p className="mt-1 text-2xs text-text-faint">
                      {problem === 'expired' ? 'Expired ' : 'Expires '}
                      {formatRelativeTime(invite.expiresAtIso) ?? 'soon'}
                    </p>
                  </div>

                  {!problem ? (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button variant="ghost" size="sm" onClick={() => void copy(invite.token)}>
                        {copied === invite.token ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-success" /> Copied
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" /> Copy
                          </>
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setRevoked((prev) => new Set(prev).add(invite.token))}
                      >
                        <Ban className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
                </div>
              </Panel>
            );
          })
        )}
      </div>
    </div>
  );
}
