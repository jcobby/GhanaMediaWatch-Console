import { redirect } from 'next/navigation';
import {
  VERIFICATION_META,
  assuranceMeta,
  nextStates,
  roleCan,
  verificationMeta,
  type EditorialCase,
  type Incident,
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
import { requireSession } from '@/lib/session';
import { Outage, load } from '@/components/ui';
import { editorial } from '@/lib/consoleApi';

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'assign_editors')) redirect('/');

  /*
   * Who is working what, from the live queue.
   *
   * The report travels with its case where the API embeds it. Nothing is
   * matched against a local list of incidents: a case whose footage this
   * console cannot see is still a real case, and pairing it with the wrong
   * report would be worse than showing it bare.
   */
  const result = await load(() => editorial.queue<EditorialCase & { incident?: Incident }>());
  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro title="Editorial desk" blurb="Who is working what, and what is ageing." />
        <Outage error={result.error} retryHref="/editorial/desk" />
      </PageShell>
    );
  }
  const cases = result.data;

  const unassigned = cases.filter((c) => !c.assignedToEditorName);
  const byEditor = new Map<string, number>();
  for (const c of cases) {
    if (!c.assignedToEditorName) continue;
    byEditor.set(c.assignedToEditorName, (byEditor.get(c.assignedToEditorName) ?? 0) + 1);
  }

  return (
    <PageShell>
      <PageIntro title="Editorial desk" blurb="Who is working what, and what is ageing." />

      <StatGrid>
        <Stat label="In the queue" value={String(cases.length)} />
        <Stat
          label="Unassigned"
          value={String(unassigned.length)}
          tone={unassigned.length ? 'warn' : 'good'}
        />
        <Stat label="Editors working" value={String(byEditor.size)} />
        <Stat
          label="Class C in queue"
          value={String(cases.filter((c) => c.incident?.assurance === 'C').length)}
          tone="warn"
          hint="Cannot stand alone"
        />
      </StatGrid>

      <Panel title="Load" subtitle="Who is carrying what.">
        <Table
          columns={['Editor', 'Cases']}
          rows={
            byEditor.size
              ? [...byEditor.entries()].map(([name, n]) => [
                  <span key="e" className="font-medium text-text-primary">
                    {name}
                  </span>,
                  <span key="n" className="tabular">
                    {n}
                  </span>,
                ])
              : []
          }
          align={[1]}
        />
      </Panel>

      <Panel
        title="The queue"
        subtitle="Assurance is a technical fact. Verification is an editorial judgement. Nothing collapses the two."
      >
        <Table
          columns={['Report', 'Assurance', 'State', 'Can move to', 'Editor']}
          rows={cases.map((c) => {
            const i = c.incident;
            const onward = i ? nextStates(i.verification) : [];
            return [
              <code key="r" className="text-xs">
                {i?.reportId ?? c.incidentId}
              </code>,
              <Pill
                key="a"
                tone={i?.assurance === 'C' ? 'bad' : i?.assurance === 'B' ? 'warn' : 'info'}
              >
                Class {i?.assurance ?? '—'}
                {i && !assuranceMeta(i.assurance).usableAlone ? ' · lead only' : ''}
              </Pill>,
              <span key="s" className="text-xs text-text-muted">
                {i ? verificationMeta(i.verification).label : '—'}
              </span>,
              <span key="n" className="text-xs text-text-faint">
                {onward.length
                  ? onward.map((s) => VERIFICATION_META[s].label).join(', ')
                  : 'nothing — terminal'}
              </span>,
              c.assignedToEditorName ? (
                <span key="e" className="text-xs text-text-secondary">
                  {c.assignedToEditorName}
                </span>
              ) : (
                <Pill key="e" tone="warn">
                  Unassigned
                </Pill>
              ),
            ];
          })}
        />
      </Panel>

      <Note tone="warn">
        <span className="font-semibold">
          Nothing reaches a verified state without passing through corroboration.
        </span>{' '}
        Verification is the act of corroborating — allowing the jump would let one click turn an
        unreviewed submission into a published fact. Rejection is terminal for the same reason in
        reverse: reinstating something judged fabricated has to be a new record, not an edit that
        erases the judgement.
      </Note>

      <Note>
        A Class C upload can never stand alone however far editorial gets. The class gates the
        state, not the other way round — an external file an editor marked verified is still only
        usable as corroborated material.
      </Note>
    </PageShell>
  );
}
