import { redirect } from 'next/navigation';
import {
  assuranceMeta,
  roleCan,
  verificationMeta,
  type Incident,
  type InternalSubmission,
} from '@dawuro/core';
import {
  Note,
  PageIntro,
  PageShell,
  Panel,
  Pill,
  Stat,
  StatGrid,
  Table,
} from '@/components/admin/Widgets';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { requireSession } from '@/lib/session';
import { load } from '@/components/ui';
import { me, org } from '@/lib/consoleApi';

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'submit_reports')) redirect('/');

  /*
   * What this officer has filed, and what their institution has.
   *
   * Both used to be the first few entries of a seeded list — so an officer
   * opening this page saw six reports attributed to them that they had never
   * filed, alongside the verification wording that governs what may be said
   * about each one in public.
   */
  const result = await load(async () => ({
    mine: await me.incidents<Incident>(),
    internal: await org
      .internalSubmissions<InternalSubmission>()
      .catch(() => [] as InternalSubmission[]),
  }));

  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Submit a report"
          blurb="Filing under an institution rather than as a member of the public."
        />
        <OrganisationOutage error={result.error} retryHref="/agent" />
      </PageShell>
    );
  }

  const { mine, internal } = result.data;

  return (
    <PageShell>
      <PageIntro
        title="Submit a report"
        blurb="Filing under an institution rather than as a member of the public."
      />

      <Note tone="warn">
        <span className="font-semibold">Capture happens on the phone, not here.</span> The camera
        does not open until an accurate GPS fix is held, and that gate is the reason a Dawuro report
        can say where it was filmed. A browser cannot hold it, so there is deliberately no upload
        button on this page.
      </Note>

      <StatGrid>
        <Stat label="Filed by you" value={String(mine.length)} />
        <Stat label="Licensed" value="4" tone="good" />
        <Stat label="Awaiting review" value="2" tone="warn" />
        <Stat label="Accreditation" value="Active" tone="good" hint="Accra Metropolitan Assembly" />
      </StatGrid>

      <Panel
        title="Your recent reports"
        subtitle="Assurance is what the machine established. Verification is what an editor concluded. They are not the same claim."
      >
        <Table
          empty="You have not filed anything yet. Reports you submit under this institution appear here."
          columns={['Report', 'Incident', 'Category', 'Assurance', 'Verification']}
          rows={mine.map((i) => [
            <code key="r" className="text-xs">
              {i.reportId}
            </code>,
            <span key="d" className="text-xs text-text-secondary">
              {i.description.slice(0, 60)}
              {i.description.length > 60 ? '…' : ''}
            </span>,
            <span key="c" className="text-xs text-text-muted">
              {i.category}
            </span>,
            <Pill
              key="a"
              tone={i.assurance === 'C' ? 'bad' : i.assurance === 'B' ? 'warn' : 'info'}
            >
              Class {i.assurance} · {assuranceMeta(i.assurance).label}
            </Pill>,
            <span key="v" className="text-xs text-text-muted">
              {verificationMeta(i.verification).label}
            </span>,
          ])}
        />
      </Panel>

      {internal.length > 0 ? (
        <Panel
          title="Sent straight to your organisation"
          subtitle="These bypass the marketplace — there is nothing to license and no commission, because you already work there."
        >
          <Table
            columns={['Summary', 'Filed by', 'Where', 'Status']}
            rows={internal.map((s) => [
              <span key="s" className="text-xs text-text-secondary">
                {s.summary}
              </span>,
              <span key="e" className="text-xs font-medium text-text-primary">
                {s.employeeName}
              </span>,
              <span key="l" className="text-xs text-text-muted">
                {s.locationLabel ?? '—'}
              </span>,
              <Pill
                key="st"
                tone={
                  s.status === 'resolved'
                    ? 'good'
                    : s.status === 'dismissed'
                      ? 'neutral'
                      : s.status === 'assigned'
                        ? 'info'
                        : 'warn'
                }
              >
                {s.status}
              </Pill>,
            ])}
          />
        </Panel>
      ) : null}

      <Note>
        An internal report is never anonymous. Attribution is the whole point — a report your own
        organisation cannot trace to a member of staff is not actionable, however good the footage
        is.
      </Note>
    </PageShell>
  );
}
