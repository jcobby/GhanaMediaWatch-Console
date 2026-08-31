import { redirect } from 'next/navigation';
import {
  ADMIN_ROLES,
  ROLE_META,
  roleCan,
  rolesWith,
  type ConsoleCapability,
} from '@dawuro/core';
import { Note, PageIntro, PageShell, Panel, Stat, StatGrid, Table } from '@/components/admin/Widgets';
import { requireSession } from '@/lib/session';
import { AdminManager, UnofferedRoles } from './AdminManager';

/** The authorities worth showing as a grid — the ones that decide real power. */
const MATRIX: { id: ConsoleCapability; label: string }[] = [
  { id: 'manage_admins', label: 'Admins' },
  { id: 'manage_keys', label: 'Keys' },
  { id: 'override_routing', label: 'Routing' },
  { id: 'approve_institutions', label: 'Approve' },
  { id: 'run_screening', label: 'Screening' },
  { id: 'run_payouts', label: 'Payouts' },
  { id: 'view_audit_log', label: 'Audit' },
];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_admins')) redirect('/');

  return (
    <PageShell>
      <PageIntro
        title="Administrators"
        blurb="Who runs the platform, and the only place a new one is created."
      />

      <Note>
        <span className="font-semibold">You are the platform owner.</span> Every other
        administrator exists because this account created them, and nothing else in the product can.
        That is deliberate: an account that can grant any authority should be used rarely and
        deliberately, never for day-to-day work.
      </Note>

      <StatGrid>
        <Stat label="Administrators" value="9" />
        <Stat label="Roles available" value={String(ADMIN_ROLES.length)} />
        <Stat
          label="Can create admins"
          value={String(rolesWith('manage_admins').length)}
          hint="This role, alone"
        />
        <Stat label="Read-only" value="1" hint="The auditor, structurally" />
      </StatGrid>

      <AdminManager actorName={session.displayName} />

      <Panel
        title="Who can do what"
        subtitle="The authorities that matter, rather than every capability."
      >
        <Table
          columns={['Role', ...MATRIX.map((m) => m.label)]}
          rows={ADMIN_ROLES.map((role) => [
            <span key="r" className="whitespace-nowrap font-medium text-text-primary">
              {ROLE_META[role].label}
            </span>,
            ...MATRIX.map((m) =>
              roleCan(role, m.id) ? (
                <span key={m.id} className="text-success" aria-label="yes">
                  ●
                </span>
              ) : (
                <span key={m.id} className="text-text-faint" aria-label="no">
                  ·
                </span>
              ),
            ),
          ])}
          align={MATRIX.map((_, i) => i + 1)}
        />
      </Panel>

      <UnofferedRoles />
    </PageShell>
  );
}
