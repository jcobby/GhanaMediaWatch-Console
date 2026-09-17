'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import { PLATFORM_ROLES, ROLE_META, roleCan, type PlatformRole } from '@dawuro/core';
import { Button, Field } from '@/components/ui';
import { Note, Panel, Pill, Table } from '@/components/admin/Widgets';
import {
  ADMIN_ROLE_COPY,
  lockedReason,
  type LiveAdmin,
  type LiveAdminRole,
} from '@/lib/admins';

/**
 * Creating and managing the people who run the platform.
 *
 * Every change is sent to `/platform/admins` and the table then shows the
 * administrator the service returned. This screen used to hold nine invented
 * people — names, emails and all — in React state, and every change vanished on
 * reload.
 *
 * Two rules are shown at the control rather than discovered by pressing it:
 * nobody changes their own access, and the last platform owner cannot be
 * removed, suspended or demoted. The service enforces both.
 */
interface AdminAnswer {
  admin?: LiveAdmin | null;
  removed?: boolean;
  error?: string;
}

export function AdminManager({
  admins: initial,
  roles,
  selfEmail,
}: {
  admins: LiveAdmin[];
  roles: LiveAdminRole[];
  selfEmail: string;
}) {
  const router = useRouter();
  const [admins, setAdmins] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<LiveAdminRole>(roles.includes('editor') ? 'editor' : roles[0]!);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  const missing: string[] = [];
  if (!name.trim()) missing.push('a name');
  if (!/.+@.+\..+/.test(email)) missing.push('a valid email');

  /** One change. Nothing on screen moves until the service has accepted it. */
  const call = async (key: string, body: Record<string, unknown>) => {
    setBusy(key);
    setFailure(null);
    try {
      const res = await fetch('/api/platform/admins', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let answer: AdminAnswer | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as AdminAnswer) : null;
      } catch {
        answer = null;
      }
      if (!res.ok || !answer) {
        setFailure(answer?.error ?? `That could not be saved — the service answered ${res.status}.`);
        return null;
      }
      router.refresh();
      return answer;
    } catch {
      setFailure('The console could not reach its own server. Nothing was changed.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const replace = (admin: LiveAdmin | null | undefined) => {
    if (!admin) return;
    setAdmins((prev) =>
      prev.some((a) => a.id === admin.id)
        ? prev.map((a) => (a.id === admin.id ? admin : a))
        : [...prev, admin],
    );
  };

  const add = async () => {
    const answer = await call('create', {
      action: 'create',
      email: email.trim(),
      displayName: name.trim(),
      role,
    });
    if (!answer) return;
    replace(answer.admin);
    setName('');
    setEmail('');
    setAdding(false);
  };

  return (
    <>
      <Panel
        title="Administrators"
        subtitle="Only a platform owner can add, change or remove one."
        action={
          <Button size="sm" onClick={() => setAdding((v) => !v)}>
            {adding ? (
              <>
                <X className="h-3.5 w-3.5" /> Cancel
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" /> Add administrator
              </>
            )}
          </Button>
        }
      >
        {failure ? (
          <p
            role="alert"
            className="mb-4 rounded-sm border border-danger/25 bg-danger-wash px-3 py-2 text-xs text-danger"
          >
            {failure}
          </p>
        ) : null}

        {adding ? (
          <div className="mb-5 space-y-4 rounded-md border border-accent/25 bg-accent-wash/25 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
              <Field
                label="Work email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@dawuro.gh"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-admin-role" className="text-xs font-medium text-text-secondary">
                Role
              </label>
              <select
                id="new-admin-role"
                value={role}
                onChange={(e) => setRole(e.target.value as LiveAdminRole)}
                className="h-10 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base"
              >
                {roles.map((r) => (
                  <option key={r} value={r}>
                    {ADMIN_ROLE_COPY[r].label}
                  </option>
                ))}
              </select>
              <p className="text-2xs leading-relaxed text-text-muted">
                {ADMIN_ROLE_COPY[role].description}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-3">
              {missing.length > 0 ? (
                <p className="text-2xs text-text-muted">Still needed: {missing.join(', ')}.</p>
              ) : null}
              <Button
                disabled={missing.length > 0}
                loading={busy === 'create'}
                onClick={() => void add()}
              >
                Create administrator
              </Button>
            </div>
          </div>
        ) : null}

        <Table
          empty="No administrators yet. You add them here — nobody signs up into an admin role."
          columns={['Name', 'Role', 'Email', 'Status', '']}
          rows={admins.map((admin) => {
            const locked = lockedReason(admin, admins, selfEmail);
            const confirming = removing === admin.id;
            return [
              <span key="n" className="flex items-center gap-2 font-medium text-text-primary">
                {admin.role === 'platform_owner' ? (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.2} />
                ) : null}
                {admin.displayName ?? admin.email}
              </span>,
              admin.role ? (
                <select
                  key="r"
                  aria-label={`Role for ${admin.displayName ?? admin.email}`}
                  title={locked ?? undefined}
                  value={admin.role}
                  disabled={locked !== null || busy !== null}
                  onChange={(e) =>
                    void call(`role:${admin.id}`, {
                      action: 'update',
                      id: admin.id,
                      role: e.target.value,
                    }).then((answer) => replace(answer?.admin))
                  }
                  className="h-8 rounded-sm border border-hairline/15 bg-canvas-soft px-2 text-xs disabled:opacity-60"
                >
                  {roles.map((r) => (
                    <option key={r} value={r}>
                      {ADMIN_ROLE_COPY[r].label}
                    </option>
                  ))}
                </select>
              ) : (
                <span key="r" className="text-xs text-text-muted">
                  {admin.roleRaw}
                </span>
              ),
              <code key="e" className="text-xs text-text-muted">
                {admin.email}
              </code>,
              admin.suspended ? (
                <Pill key="s" tone="bad">
                  Suspended
                </Pill>
              ) : (
                <Pill key="s" tone="good">
                  Active
                </Pill>
              ),
              confirming ? (
                <span key="x" className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                  <span className="text-2xs text-text-muted">Remove?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    loading={busy === `remove:${admin.id}`}
                    onClick={() =>
                      void call(`remove:${admin.id}`, { action: 'remove', id: admin.id }).then(
                        (answer) => {
                          if (!answer?.removed) return;
                          setAdmins((prev) => prev.filter((a) => a.id !== admin.id));
                          setRemoving(null);
                        },
                      )
                    }
                  >
                    Yes
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setRemoving(null)}>
                    No
                  </Button>
                </span>
              ) : (
                <span key="x" className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    title={locked ?? undefined}
                    disabled={locked !== null || busy !== null}
                    loading={busy === `suspend:${admin.id}`}
                    onClick={() =>
                      void call(`suspend:${admin.id}`, {
                        action: 'update',
                        id: admin.id,
                        suspended: !admin.suspended,
                      }).then((answer) => replace(answer?.admin))
                    }
                  >
                    {admin.suspended ? 'Reinstate' : 'Suspend'}
                  </Button>
                  <button
                    type="button"
                    disabled={locked !== null || busy !== null}
                    title={locked ?? 'Remove'}
                    aria-label={`Remove ${admin.displayName ?? admin.email}`}
                    onClick={() => setRemoving(admin.id)}
                    className="rounded-xs p-1.5 text-text-faint transition hover:bg-danger-wash hover:text-danger disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-text-faint"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                  </button>
                </span>
              ),
            ];
          })}
          align={[4]}
        />
      </Panel>

      <Note tone="warn">
        <span className="font-semibold">The last platform owner cannot be removed.</span> Its
        controls are disabled while only one remains. A platform with nobody who can grant access
        cannot recover on its own.
      </Note>
    </>
  );
}

/** Roles that exist but are not offered here, and why. */
export function UnofferedRoles() {
  const service = PLATFORM_ROLES.filter((r) => ROLE_META[r].module === 'service');

  return (
    <Panel
      title="Not created here"
      subtitle="Service-module roles belong to an institution, not to the platform."
    >
      <p className="mb-3 text-xs leading-relaxed text-text-muted">
        A dispatcher works for the Accra Metropolitan Assembly, not for Dawuro. Their account is
        created by their own organisation and confirmed by someone already inside it — the platform
        creating them would mean anyone could be given access to an inbox that is not theirs.
      </p>
      <div className="flex flex-wrap gap-1.5">
        {service.map((r) => (
          <Pill key={r}>{ROLE_META[r].label}</Pill>
        ))}
      </div>
    </Panel>
  );
}

/** Exposed for the page's capability check. */
export const CAN_MANAGE = (role: PlatformRole | null) => roleCan(role, 'manage_admins');
