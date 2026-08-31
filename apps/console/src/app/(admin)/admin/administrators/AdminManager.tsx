'use client';

import { useState } from 'react';
import { Plus, ShieldCheck, Trash2, X } from 'lucide-react';
import {
  ADMIN_ROLES,
  MODULE_META,
  PLATFORM_ROLES,
  ROLE_META,
  isReadOnly,
  roleCan,
  type PlatformRole,
} from '@dawuro/core';
import { Button, Field } from '@/components/ui';
import { Note, Panel, Pill, Table } from '@/components/admin/Widgets';
import { cn } from '@/lib/cn';

/**
 * Creating and managing the people who run the platform.
 *
 * **Simulated** — changes live in component state and are gone on reload,
 * because there is no backend to persist them. The rules being demonstrated
 * are real though, and they are the point of the screen:
 *
 *   - Only the platform owner reaches this page at all.
 *   - An owner cannot be modified or removed by anyone else.
 *   - The last owner can never be removed, by anybody, including themselves.
 *
 * That last one is the rule people are surprised by until the day it saves
 * them: an organisation with no owner has nobody who can restore access.
 */

interface Person {
  id: string;
  name: string;
  email: string;
  role: PlatformRole;
  addedBy: string;
}

const SEED: Person[] = [
  { id: 'p1', name: 'Ama Serwaa', email: 'super.admin@dawuro.gh', role: 'super_admin', addedBy: '—' },
  { id: 'p2', name: 'Kofi Mensah', email: 'dawuro.admin@dawuro.gh', role: 'dawuro_admin', addedBy: 'Ama Serwaa' },
  { id: 'p3', name: 'Yaw Boateng', email: 'system.admin@dawuro.gh', role: 'system_admin', addedBy: 'Ama Serwaa' },
  { id: 'p4', name: 'Akosua Danso', email: 'hr.admin@dawuro.gh', role: 'hr_admin', addedBy: 'Ama Serwaa' },
  { id: 'p5', name: 'Kwabena Owusu', email: 'operations@dawuro.gh', role: 'operations', addedBy: 'Ama Serwaa' },
  { id: 'p6', name: 'Efua Asante', email: 'branch.manager@dawuro.gh', role: 'branch_manager', addedBy: 'Kwabena Owusu' },
  { id: 'p7', name: 'Nana Adjei', email: 'compliance.officer@dawuro.gh', role: 'compliance_officer', addedBy: 'Ama Serwaa' },
  { id: 'p8', name: 'Abena Frimpong', email: 'finance.officer@dawuro.gh', role: 'finance_officer', addedBy: 'Ama Serwaa' },
  { id: 'p9', name: 'Kwame Antwi', email: 'auditor@dawuro.gh', role: 'auditor', addedBy: 'Ama Serwaa' },
];

export function AdminManager({ actorName }: { actorName: string }) {
  const [people, setPeople] = useState<Person[]>(SEED);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<PlatformRole>('operations');

  const owners = people.filter((p) => p.role === 'super_admin');

  const missing: string[] = [];
  if (!name.trim()) missing.push('a name');
  if (!/.+@.+\..+/.test(email)) missing.push('a valid email');

  const add = () => {
    setPeople((prev) => [
      ...prev,
      { id: `p${Date.now()}`, name: name.trim(), email: email.trim(), role, addedBy: actorName },
    ]);
    setName('');
    setEmail('');
    setRole('operations');
    setAdding(false);
  };

  /** Why this person cannot be removed, or null when they can. */
  const blockedFrom = (p: Person): string | null => {
    if (p.role === 'super_admin' && owners.length <= 1) {
      return 'The last owner cannot be removed — nobody would be able to restore access.';
    }
    return null;
  };

  return (
    <>
      <Panel
        title="Administrators"
        subtitle="Only this role can add or remove one of these."
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
              <label htmlFor="role" className="text-xs font-medium text-text-secondary">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as PlatformRole)}
                className="h-10 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base"
              >
                <optgroup label={MODULE_META.admin.label}>
                  {ADMIN_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {ROLE_META[r].label}
                    </option>
                  ))}
                </optgroup>
              </select>
              <p className="text-2xs leading-relaxed text-text-muted">
                {ROLE_META[role].description}
              </p>
            </div>

            <div className="rounded-sm bg-canvas-soft/70 p-3">
              <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
                This grants
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {ROLE_META[role].capabilities.map((c) => (
                  <Pill key={c} tone="info">
                    {c.replace(/_/g, ' ')}
                  </Pill>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3">
              {missing.length > 0 ? (
                <p className="text-2xs text-text-muted">Still needed: {missing.join(', ')}.</p>
              ) : null}
              <Button disabled={missing.length > 0} onClick={add}>
                Create administrator
              </Button>
            </div>
          </div>
        ) : null}

        <Table
          columns={['Name', 'Role', 'Email', 'Added by', 'Holds', '']}
          rows={people.map((p) => {
            const meta = ROLE_META[p.role];
            const blocked = blockedFrom(p);
            return [
              <span key="n" className="flex items-center gap-2 font-medium text-text-primary">
                {p.role === 'super_admin' ? (
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-accent" strokeWidth={2.2} />
                ) : null}
                {p.name}
              </span>,
              <span key="r" className="whitespace-nowrap text-text-secondary">
                {meta.label}
                {isReadOnly(p.role) ? (
                  <span className="ml-1.5 text-2xs text-text-faint">read-only</span>
                ) : null}
              </span>,
              <code key="e" className="text-xs text-text-muted">
                {p.email}
              </code>,
              <span key="a" className="text-xs text-text-muted">
                {p.addedBy}
              </span>,
              <span key="c" className="tabular text-text-muted">
                {meta.capabilities.length}
              </span>,
              <button
                key="x"
                type="button"
                disabled={blocked !== null}
                title={blocked ?? 'Remove'}
                onClick={() => setPeople((prev) => prev.filter((q) => q.id !== p.id))}
                className={cn(
                  'rounded-xs p-1 transition',
                  blocked
                    ? 'cursor-not-allowed text-text-faint/50'
                    : 'text-text-faint hover:bg-danger-wash hover:text-danger',
                )}
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
              </button>,
            ];
          })}
          align={[4, 5]}
        />
      </Panel>

      <Note tone="warn">
        <span className="font-semibold">The last owner can never be removed.</span> Try it — the
        control is disabled while only one remains. An organisation with nobody who can grant access
        cannot recover on its own, and what should have been a click becomes a support ticket.
      </Note>

      <Note>
        Changes here are not saved. There is no backend to write them to, so this demonstrates the
        rules rather than applying them — reload and the list returns to its seeded state.
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
