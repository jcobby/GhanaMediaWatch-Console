import { redirect } from 'next/navigation';
import { roleCan } from '@dawuro/core';
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
import { platform } from '@/lib/consoleApi';
import { TakedownDecision } from './TakedownDecision';

/**
 * Requests from people who appear in footage.
 *
 * Ghana's Data Protection Act (Act 843) gives a data subject rights this
 * platform has to be able to honour. Decisions are sent to the service now, with
 * a reason required for both answers — a refusal nobody can explain is not one
 * anybody can account for later.
 *
 * The hard part was never the intake form: it is what happens to a report a
 * third party has already licensed and published. That question is still
 * unresolved, so the screen states it rather than implying a process exists.
 */
export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'handle_takedowns')) redirect('/');

  /*
   * Real requests from real people.
   *
   * This page carried four invented cases, and the comment above described it
   * as simulated. That is a defensible thing to ship in a prototype and an
   * indefensible one to leave in a console someone works from: these are
   * statutory requests under Ghana's Data Protection Act (Act 843), and a
   * fabricated queue either hides a real request or invents an obligation.
   *
   * The unresolved question the original note raised — what happens to a report
   * a third party has already licensed and published — is a product question,
   * and it is still open. The note stays; the fixtures do not.
   */
  const result = await load(() => platform.takedowns<TakedownRequest>());
  if (!result.ok) {
    return (
      <PageShell>
        <PageIntro
          title="Takedowns and right of reply"
          blurb="Requests from people who appear in footage."
        />
        <Outage error={result.error} retryHref="/admin/takedowns" />
      </PageShell>
    );
  }

  const REQUESTS = result.data;
  const open = REQUESTS.filter((r) => r.state === 'open');
  const hardest = open.filter((r) => r.licensed && r.published);

  return (
    <PageShell>
      <PageIntro
        title="Takedowns"
        blurb="Requests from people who appear in footage, under Ghana's Data Protection Act."
      />

      <StatGrid>
        <Stat label="Open" value={String(open.length)} tone={open.length ? 'warn' : 'good'} />
        <Stat
          label="Already published"
          value={String(hardest.length)}
          tone={hardest.length ? 'bad' : 'neutral'}
          hint="Licensed and out in the world"
        />
        <Stat label="Upheld" value={String(REQUESTS.filter((r) => r.state === 'upheld').length)} />
        {/*
          "Median age — 9 d" used to sit here, and it was invented. A made-up
          figure beside three real counts is the worst place for one: it reads
          with exactly the authority of the numbers either side of it, on a
          screen about statutory deadlines. Refused is a real count.
        */}
        <Stat label="Refused" value={String(REQUESTS.filter((r) => r.state === 'refused').length)} />
      </StatGrid>

      <Panel
        title="Requests"
        subtitle="Every decision here is recorded permanently, including a refusal."
      >
        <Table
          columns={['Reference', 'Report', 'From', 'Ground', 'Reach', 'State', '']}
          rows={REQUESTS.map((r) => [
            <code key="i" className="text-xs text-text-primary">
              {r.id}
            </code>,
            <code key="r" className="text-xs text-text-muted">
              {r.report}
            </code>,
            <span key="f" className="text-xs text-text-muted">
              {r.from}
            </span>,
            <span key="g" className="text-xs text-text-secondary">
              {r.ground}
            </span>,
            r.published ? (
              <Pill key="p" tone="bad">
                Published
              </Pill>
            ) : r.licensed ? (
              <Pill key="p" tone="warn">
                Licensed
              </Pill>
            ) : (
              <Pill key="p">Held only</Pill>
            ),
            <Pill
              key="s"
              tone={r.state === 'open' ? 'warn' : r.state === 'upheld' ? 'good' : 'neutral'}
            >
              {r.state}
            </Pill>,
            r.state === 'open' ? (
              <TakedownDecision key="a" takedownId={r.id} published={r.published} />
            ) : (
              <span key="a" className="text-2xs text-text-faint">
                Decided
              </span>
            ),
          ])}
          align={[6]}
        />
      </Panel>

      <Panel
        title="What a takedown can actually reach"
        subtitle="Reach shrinks the further a report has travelled — this is the honest version, not the reassuring one."
      >
        <Table
          columns={['Where the footage is', 'Can it be withdrawn?']}
          rows={[
            ['Held by Dawuro, not yet licensed', 'Yes — removed outright'],
            ['Licensed but not published', 'Yes — licence revoked, licensee notified'],
            ['Published on the Dawuro feed', 'Yes — removed, with the record retained'],
            [
              'Published by a licensee in their own channel',
              'Only by request. Dawuro cannot reach into a newsroom archive.',
            ],
            [
              'Re-shared by third parties from a licensee',
              'No. This is why sharing sends the report link, never the file.',
            ],
          ]}
        />
      </Panel>

      <Note tone="warn">
        <span className="font-semibold">The unresolved question is the fourth row.</span> A report
        licensed and published by a third party cannot simply be recalled, and no process here has
        been agreed for it. Act 843 does not stop applying because the data has moved, so this needs
        a decision from the product side before the platform carries real footage.
      </Note>
    </PageShell>
  );
}

/** A takedown or right-of-reply request, as the platform records it. */
interface TakedownRequest {
  id: string;
  report: string;
  from: string;
  ground: string;
  licensed: boolean;
  published: boolean;
  opened: string;
  state: 'open' | 'upheld' | 'refused';
}
