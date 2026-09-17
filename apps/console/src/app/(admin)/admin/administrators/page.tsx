import { redirect } from 'next/navigation';
import { roleCan } from '@dawuro/core';
import {
  Note,
  PageIntro,
  PageShell,
  Panel,
  Stat,
  StatGrid,
  Table,
} from '@/components/admin/Widgets';
import { Outage, load } from '@/components/ui';
import { requireSession } from '@/lib/session';
import { platform } from '@/lib/consoleApi';
import { ADMIN_ROLE_COPY, normaliseAdmins } from '@/lib/admins';
import { AdminManager, UnofferedRoles } from './AdminManager';

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_admins')) redirect('/');

  const result = await load(() => platform.admins<unknown>());

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Administrators"
          blurb="Who runs the platform, and the only place a new one is created."
        />
        <Outage error={result.error} retryHref="/admin/administrators" />
      </PageShell>
    );
  }

  const { admins, roles } = normaliseAdmins(result.data);
  const owners = admins.filter((a) => a.role === 'platform_owner' && !a.suspended).length;
  const suspended = admins.filter((a) => a.suspended).length;

  return (
    <PageShell>
      <PageIntro
        title="Administrators"
        blurb="Who runs the platform, and the only place a new one is created."
      />

      <Note>
        <span className="font-semibold">You are a platform owner.</span> Every other administrator
        exists because a platform owner created them, and nothing else in the product can. Use this
        account rarely and deliberately, never for day-to-day work.
      </Note>

      {/* Counted from the service's list. These were typed-in numbers — "9". */}
      <StatGrid>
        <Stat label="Administrators" value={String(admins.length)} />
        <Stat
          label="Platform owners"
          value={String(owners)}
          tone={owners <= 1 ? 'warn' : 'neutral'}
          hint={owners <= 1 ? 'Only one can restore access' : undefined}
        />
        <Stat label="Suspended" value={String(suspended)} />
        <Stat label="Roles available" value={String(roles.length)} />
      </StatGrid>

      <AdminManager admins={admins} roles={roles} selfEmail={session.email} />

      <Panel title="What each role is for" subtitle="The roles the service grants.">
        <Table
          columns={['Role', 'What it is for']}
          rows={roles.map((role) => [
            <span key="r" className="whitespace-nowrap font-medium text-text-primary">
              {ADMIN_ROLE_COPY[role].label}
            </span>,
            <span key="d" className="text-xs leading-relaxed text-text-muted">
              {ADMIN_ROLE_COPY[role].description}
            </span>,
          ])}
        />
      </Panel>

      <UnofferedRoles />
    </PageShell>
  );
}
