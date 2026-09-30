'use client';

import { useMemo, useState } from 'react';
import {
  Check,
  ArrowDownUp,
  Clock,
  Globe,
  Image as ImageIcon,
  MapPin,
  Mic,
  PanelLeftClose,
  PanelLeftOpen,
  Phone,
  AlertTriangle,
  PhoneOff,
  Users,
  Video,
} from 'lucide-react';
import {
  CORROBORATION_CHECKS,
  EMPTY_CORROBORATION,
  NEWS_SECTIONS,
  NEWS_TIER_META,
  VERIFICATION_META,
  verificationMeta,
  failedCheckDetails,
  assuranceMeta,
  categoryLabel,
  corroborationStrength,
  decisionProblem,
  deriveGates,
  formatCaptureDay,
  formatExactCapture,
  formatPlace,
  formatRelativeTime,
  hasIndependentCorroboration,
  hoursWaiting,
  nextStates,
  provisionalAssessment,
  severityMeta,
  triageScore,
  type CorroborationCheckId,
  type DecisionProblem,
  type EditorialCase,
  type Incident,
  type NewsSection,
  type ProvisionalAssessment,
  type SubmissionDestination,
  type VerificationState,
} from '@dawuro/core';
import { AutomaticScorePanel } from './AutomaticScorePanel';
import { NewsValuePanel, type NewsValueState } from './NewsValuePanel';
import { useStoredNewsValue } from './useStoredNewsValue';
import { ReleasePanel } from './ReleasePanel';
import { CaseTabs, type CaseTab } from './CaseTabs';
import { QueueThumb } from '@/components/QueueThumb';
import { LeadPanel, type LeadState } from './LeadPanel';
import { Button, Panel } from '@/components/ui';
import { MediaFrame } from '@/components/MediaFrame';
import {
  AssuranceBadge,
  HandlingNotice,
  SeverityBadge,
  VerificationBadge,
} from '@/components/TrustBadges';
import { cn } from '@/lib/cn';
import { mediaHref } from '@/lib/mediaHref';

const PROBLEM_COPY: Record<DecisionProblem, string> = {
  transition_not_allowed: 'That move is not permitted from the current state.',
  insufficient_corroboration: 'Not enough corroboration has been done for this decision.',
  needs_independent_corroboration:
    'This capture cannot stand alone. Establish something independent of the reporter first.',
  reason_required: 'Record why. The decision is kept permanently.',
};

/**
 * The verification desk.
 *
 * Triage on the left, one case on the right. The queue is ordered by what needs
 * attention rather than by arrival: a fresh emergency outranks a week-old
 * observation, which a first-in-first-out queue gets exactly backwards.
 *
 * The decision panel refuses rather than warns. An editor cannot mark something
 * verified without the corroboration to support it, and the reason is stated —
 * a disabled button with no explanation teaches people to distrust the tool.
 */
export function Workbench({
  reports,
  cases,
  editorName,
}: {
  reports: Incident[];
  cases: EditorialCase[];
  editorName: string;
}) {
  const now = new Date().toISOString();

  const queue = useMemo(() => {
    return reports
      .map((incident) => ({
        incident,
        score: triageScore(
          incident.assurance,
          severityMeta(incident.severity).weight,
          hoursWaiting(incident.capturedAtIso ?? now, now),
        ),
      }))
      .sort((a, b) => b.score - a.score);
  }, [reports, now]);

  /*
   * How the queue is broken up, chosen by whoever is working it.
   *
   * One flat list ordered by urgency answers "what next?" and nothing else. A
   * desk also works in sweeps — everything filmed this morning, everything on
   * flooding — and a flat list makes both of those a hunt down nineteen rows
   * with no way to see that six of them are the same story.
   *
   * Urgency stays the default because it is the one that answers the first
   * question. Grouping never re-ranks: within every group the order is still
   * triage, so switching the view cannot quietly change what an editor picks
   * up next.
   */
  /*
   * Whether the queue is showing.
   *
   * Not a nicety: a desk at 1280 CSS pixels is already spending 230 on the
   * navigation and 300 on this list, and three columns do not fit in what is
   * left. Closing it is what makes the evidence-and-judgement split possible on
   * an ordinary screen — and an editor deep in one case does not need
   * forty-five rows in view to work it.
   */
  const [queueOpen, setQueueOpen] = useState(true);
  const [grouping, setGrouping] = useState<Grouping>('urgency');
  /* Today first, which is the day an editor opening the date view wants. */
  const [dateOrder, setDateOrder] = useState<DateOrder>('newest');
  /*
   * Which part of the case is open. Kept across reports on purpose: an editor
   * sweeping the queue for news value should not be sent back to the footage on
   * every row they open.
   */
  const [tab, setTab] = useState<CaseTab>('evidence');
  const groups = useMemo(
    () => groupQueue(queue, grouping, dateOrder),
    [queue, grouping, dateOrder],
  );

  /*
   * A news value for every report on arrival, from the record alone.
   *
   * Severity, category, age, destination, the file itself and where it was
   * filmed are all things the platform already knows, so nothing has to wait
   * for an editor to open it before it has a number. Five of the ten criteria
   * cannot be evidenced this way and are reported as unassessed rather than
   * guessed at — `NewsValuePanel` shows them in amber so the provisional score
   * is never mistaken for somebody's judgement.
   *
   * The queue is still ordered by triage, not by this. They answer different
   * questions: triage is what needs attention next, news value is what leads.
   * An unverified emergency outranks a well-scored feature for review even
   * though the feature would lead the bulletin.
   */
  const assessments = useMemo(() => {
    const byIncident = new Map(cases.map((c) => [c.incidentId, c]));
    const out: Record<string, ProvisionalAssessment> = {};
    for (const incident of reports) {
      out[incident.id] = provisionalAssessment({
        category: incident.category,
        severity: incident.severity,
        mediaKind: incident.media.kind,
        assurance: incident.assurance,
        destination: (incident as { destination?: SubmissionDestination }).destination ?? null,
        capturedAtIso: incident.capturedAtIso,
        nowIso: now,
        location: incident.location,
        corroboration: byIncident.get(incident.id)?.corroboration ?? EMPTY_CORROBORATION,
      });
    }
    return out;
  }, [reports, cases, now]);

  /*
   * Null until an editor picks something, which is not the same as "nothing is
   * selected".
   *
   * It used to be seeded with `queue[0]` — the highest triage score — and the
   * preview then stayed on that report no matter how the list was arranged. An
   * editor choosing **Date, newest first** got a list headed TODAY and a pane
   * showing something filed on the 4th, because urgency counts waiting time and
   * the oldest report has by definition waited longest. Arithmetically right,
   * and the opposite of what the person clicking "newest first" asked for.
   *
   * So the default follows the order on screen, and an explicit choice does not:
   * once an editor has picked a report, changing the grouping rearranges the
   * list around them rather than moving them off what they were reading.
   */
  const [selectedId, setSelectedId] = useState<string | null>(null);

  /** The top of the list as it is actually displayed, whatever that ordering is. */
  const firstShown = groups[0]?.items[0]?.incident ?? null;
  const selected =
    (selectedId ? reports.find((r) => r.id === selectedId) : null) ?? firstShown ?? null;

  /** An editor's own assessment, once they start one. Keyed by incident. */
  const [newsValue, setNewsValue] = useState<Record<string, NewsValueState>>({});

  /*
   * The stored assessment, and where a change goes.
   *
   * This panel spent its life apologising for being unsaved. The endpoint
   * exists now, so an editor's ratings survive a reload and a colleague can
   * see them — and the amber box that said otherwise is gone.
   */
  const {
    stored: storedNewsValue,
    saveState,
    change: saveNewsValue,
  } = useStoredNewsValue(selected?.id ?? null);

  /** Live editorial state, keyed by incident, seeded from the fixtures. */
  const [live, setLive] = useState<Record<string, EditorialCase>>(() =>
    Object.fromEntries(cases.map((c) => [c.incidentId, c])),
  );
  const [decisionError, setDecisionError] = useState<string | null>(null);
  /**
   * Why the last corroboration tick did not take, shown beside the checklist.
   *
   * **Separate from `decisionError` because it is read in a different place.**
   * A tick is optimistic: the box moves at once and the request follows, and if
   * the request fails the box moves back. That is the honest version of
   * optimism — but the explanation was rendered down in the decision panel,
   * several hundred pixels below and usually scrolled off the screen. So an
   * editor ticked a box, watched it silently untick itself, and had no way at
   * all to find out why. Reported exactly like that: "when I select under the
   * corroboration, it unchecks."
   *
   * A failure has to appear where the failure happened.
   */
  const [checkError, setCheckError] = useState<{
    id: CorroborationCheckId;
    message: string;
  } | null>(null);
  /** Set when a decision put the report on the feed, so the desk can say so. */
  const [published, setPublished] = useState<{ id: string; section: string | null } | null>(null);
  /*
   * Leads changed on this page, keyed by incident. The record's own `lead` is
   * the starting point; what an editor sets here overrides it without a reload.
   */
  const [leads, setLeads] = useState<Record<string, LeadState>>({});
  const [states, setStates] = useState<Record<string, VerificationState>>(() =>
    Object.fromEntries(reports.map((r) => [r.id, r.verification])),
  );

  if (!selected) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-sm text-text-faint">The queue is clear.</p>
      </div>
    );
  }

  const activeCase: EditorialCase = live[selected.id] ?? {
    incidentId: selected.id,
    assignedToEditorName: null,
    corroboration: EMPTY_CORROBORATION,
    contacts: [],
    notes: [],
    decisions: [],
    redactionApplied: false,
  };
  const state = states[selected.id] ?? selected.verification;

  /*
   * Seeded from the record, not from an empty form.
   *
   * The provisional ratings, the modifiers the coordinates and corroboration
   * already imply, and the two gates the platform can answer for itself are all
   * filled in before the editor sees them. Asking somebody to re-enter what
   * Dawuro already knows — that there are children in the footage and nobody
   * has redacted it, that two independent checks are recorded — invites a tired
   * yes on the one question that must never get one.
   */
  const assessment =
    assessments[selected.id] ??
    provisionalAssessment({
      category: selected.category,
      severity: selected.severity,
      mediaKind: selected.media.kind,
      assurance: selected.assurance,
      destination: (selected as { destination?: SubmissionDestination }).destination ?? null,
      capturedAtIso: selected.capturedAtIso,
      nowIso: now,
      location: selected.location,
      corroboration: activeCase.corroboration,
    });

  /*
   * Three sources, in order of authority.
   *
   * What this editor has typed since the page loaded; then whatever the store
   * holds, because a colleague's judgement outranks a derivation; then the
   * record, which is where a report nobody has assessed starts from.
   *
   * Field by field rather than whole-object, because the store merges: an
   * assessment saved before the modifiers existed has ratings and no
   * modifiers, and taking it wholesale would blank them.
   */
  const seeded: NewsValueState = {
    gates: deriveGates({
      corroboration: activeCase.corroboration,
      handling: selected.handling,
      redactionApplied: activeCase.redactionApplied,
    }),
    ratings: assessment.ratings,
    modifiers: assessment.modifiers,
    unassessed: assessment.unassessed,
    election: { inCampaignPeriod: false, partisanClaim: false, hasSameCycleResponse: false },
    ownership: {
      involvesOwner: false,
      involvesAdvertiser: false,
      involvesAffiliatedParty: false,
    },
  };

  const activeNewsValue: NewsValueState = newsValue[selected.id] ?? {
    gates: storedNewsValue?.gates ?? seeded.gates,
    ratings: storedNewsValue?.ratings ?? seeded.ratings,
    modifiers: storedNewsValue?.modifiers ?? seeded.modifiers,
    /*
     * An empty `unassessed` from the store is a real answer — somebody rated
     * all ten — so it is taken whenever the field is present at all, not
     * whenever it is truthy.
     */
    unassessed: storedNewsValue?.unassessed ?? seeded.unassessed,
    election: storedNewsValue?.election ?? seeded.election,
    ownership: storedNewsValue?.ownership ?? seeded.ownership,
  };

  /**
   * Tick a corroboration check, and tell the platform.
   *
   * **This is the gate on publishing.** A transition to
   * `verified_high_confidence` is refused with `Corroboration gate failed:
   * insufficient_corroboration` until enough checks are recorded, and reaching
   * that state is what sets `vettingState: published` and puts the report on
   * the app's home feed.
   *
   * This was `setLive` alone. An editor could tick every box, watch the bar
   * reach 100%, press the decision — and be told there was not enough
   * corroboration, because none of it had left the browser. The screen and the
   * server disagreed about the same report, and only the server's opinion
   * counted.
   *
   * The weight and independence come from `CORROBORATION_CHECKS`, so the
   * numbers sent are the shared ones rather than a second set invented here.
   */
  /**
   * Tick a corroboration check.
   *
   * **Instant, then saved.** Each tick is a request, and against a cold Render
   * instance that is a second or two — so waiting for the round trip before
   * showing the box ticked made working through seven checks feel broken, and
   * an editor with a queue does this on every report. The box moves at once and
   * the request follows; if it fails the box moves back and says why, which is
   * the only version of optimism that is honest.
   *
   * **No tick-everything shortcut, deliberately.** Each of these is a claim
   * that a specific piece of work was done — a witness spoken to, a record
   * checked — and they are what allow a report to be called verified and put in
   * front of the public. One button asserting all seven would make the gate
   * decorative, which is the failure this whole module exists to prevent.
   * Speed comes from removing the waiting, not from removing the deciding.
   *
   * The weight and independence come from `CORROBORATION_CHECKS`, so what is
   * sent is the shared definition rather than a second set of numbers.
   */
  const toggleCheck = (id: CorroborationCheckId) => {
    const current = live[selected.id] ?? activeCase;
    const done = current.corroboration.completed.includes(id);
    const meta = CORROBORATION_CHECKS.find((c) => c.id === id);

    /** The list with this check flipped. Used to apply, and to undo. */
    const withCheck = (ticked: boolean) => (previous: Record<string, EditorialCase>) => {
      const now = previous[selected.id] ?? activeCase;
      return {
        ...previous,
        [selected.id]: {
          ...now,
          corroboration: {
            ...now.corroboration,
            completed: ticked
              ? [...now.corroboration.completed.filter((c) => c !== id), id]
              : now.corroboration.completed.filter((c) => c !== id),
          },
        },
      };
    };

    setCheckError(null);
    setDecisionError(null);
    setLive(withCheck(!done));
    if (!meta) return;

    void (async () => {
      try {
        const res = await fetch(`/api/editorial/${encodeURIComponent(selected.id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'corroborate',
            source: meta.id,
            weight: meta.weight,
            passed: !done,
            independent: meta.independent,
          }),
        });
        const answer = (await res.json()) as {
          error?: string;
          upstreamStatus?: number;
          verification?: string | null;
        };

        if (!res.ok) {
          // Put it back. A tick the platform never received must not sit on
          // screen looking like recorded work.
          setLive(withCheck(done));
          /*
           * The service's own sentence and its status. "That check could not be
           * recorded" on its own tells an editor nothing they can act on, and
           * the status is what separates a permission problem from a report
           * that has moved on underneath them.
           */
          setCheckError({
            id,
            message: answer.error
              ? `${answer.error}${answer.upstreamStatus ? ` (${answer.upstreamStatus})` : ''}`
              : 'That check could not be recorded.',
          });
          return;
        }

        /*
         * The report may have moved, so the decision buttons must move with it.
         *
         * The first check takes a report from `integrity_passed` to
         * `corroboration_in_progress`. The desk went on offering the
         * transitions from the state *before* the tick, so pressing
         * "Corroborating" asked the platform to move from
         * `corroboration_in_progress` to itself and was refused — an editor
         * doing exactly the right thing, told they could not.
         */
        if (answer.verification) {
          setStates((prev) => ({
            ...prev,
            [selected.id]: answer.verification as VerificationState,
          }));
        }
      } catch {
        setLive(withCheck(done));
        setCheckError({
          id,
          message: 'The console could not reach its own server. Nothing was recorded.',
        });
      }
    })();
  };

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden">
      {/* ── Triage queue ─────────────────────────────────────────────────
        Collapses to a strip. See `queueOpen`.
      */}
      {!queueOpen ? (
        <button
          type="button"
          onClick={() => setQueueOpen(true)}
          title="Show the queue"
          className="flex w-11 shrink-0 flex-col items-center gap-2 border-r border-hairline/[0.07] py-3 transition hover:bg-canvas-raise/60"
        >
          <PanelLeftOpen className="h-4 w-4 text-text-muted" strokeWidth={2} />
          <span className="tabular text-2xs font-semibold text-text-secondary">{queue.length}</span>
          <span className="[writing-mode:vertical-rl] text-2xs uppercase tracking-[0.14em] text-text-faint">
            Queue
          </span>
        </button>
      ) : null}

      <div
        className={cn(
          'flex w-[300px] shrink-0 flex-col border-r border-hairline/[0.07]',
          queueOpen ? '' : 'hidden',
        )}
      >
        {/*
          The title of the page lives here now.

          The desk used to open under a page header, then a count, then a
          grouping control, then — under Date — a second control on a row of its
          own: four bands before the first report. Title and count share a line,
          and both controls share the next.
        */}
        <div className="shrink-0 space-y-2.5 border-b border-hairline/[0.07] px-3.5 pb-3 pt-4">
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold tracking-[-0.01em] text-text-primary">Triage</h1>
            <span className="tabular rounded-pill bg-accent-wash px-2 text-2xs font-semibold text-accent">
              {queue.length}
            </span>
            <button
              type="button"
              onClick={() => setQueueOpen(false)}
              title="Hide the queue"
              aria-label="Hide the queue"
              className="-mr-1 ml-auto shrink-0 rounded-xs p-1 text-text-faint transition hover:bg-canvas-raise hover:text-text-secondary"
            >
              <PanelLeftClose className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>

          {/*
            What the order actually is, said once.

            It read "most urgent first" whatever the view — so grouped by date,
            with the newest day at the top, the header was describing a
            different list from the one underneath it.
          */}
          <p className="-mt-1 text-2xs text-text-muted">
            Waiting
            {grouping === 'urgency'
              ? ', most urgent first'
              : grouping === 'date'
                ? `, ${dateOrder === 'newest' ? 'newest' : 'oldest'} day first`
                : ', by subject'}
          </p>

          <div className="flex items-center gap-1.5">
            <div className="min-w-0 flex-1">
              <GroupPicker value={grouping} onChange={setGrouping} />
            </div>
            {grouping === 'date' ? (
              <DateOrderPicker value={dateOrder} onChange={setDateOrder} />
            ) : null}
          </div>
        </div>

        <ul className="min-h-0 flex-1 overflow-y-auto">
          {groups.map((group) => (
            <li key={group.key}>
              {/*
                Sticky, because the whole value of a group is knowing which one
                you are in — and a desk scrolls past the heading within three
                rows. `urgency` produces a single unlabelled group, so the flat
                list is unchanged rather than gaining a heading that says
                nothing.
              */}
              {group.label ? (
                <p className="sticky top-0 z-10 flex items-baseline gap-2 border-b border-hairline/[0.07] bg-canvas/95 px-3 py-1.5 backdrop-blur">
                  <span className="text-2xs font-semibold uppercase tracking-[0.12em] text-text-secondary">
                    {group.label}
                  </span>
                  <span className="tabular text-2xs text-text-faint">{group.items.length}</span>
                </p>
              ) : null}

              <ul>
                {group.items.map(({ incident }) => {
                  const active = selected.id === incident.id;
                  const s = states[incident.id] ?? incident.verification;
                  const when = formatExactCapture(
                    incident.capturedAtIso,
                    incident.capturedAtPrecision,
                  );
                  const where = formatPlace(incident.location);
                  return (
                    <li key={incident.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(incident.id)}
                        className={cn(
                          'relative w-full border-l-2 px-3.5 py-3 text-left transition',
                          active
                            ? 'border-l-accent bg-accent-wash/40'
                            : 'border-l-transparent hover:bg-canvas-raise/60',
                        )}
                      >
                        {/*
                          The description first, and at a readable size.

                          The row led with four badges and a reference and put
                          the only sentence a person wrote third, in 12px
                          secondary. Forty-five rows of that is a wall: the eye
                          has nothing to land on, and scanning means reading
                          every row rather than recognising one.

                          Everything else is meta, and now reads as meta —
                          beneath, quieter, on one line.
                        */}
                        {/*
                          A preview beside the words, so the next report can be
                          chosen by what was filmed as well as what was written.
                          The preview says photo, clip or recording by itself, so
                          the small kind glyph that did that job is not repeated.
                        */}
                        <span className="flex items-start gap-3">
                          <QueueThumb incident={incident} />
                          <span
                            className={cn(
                              'min-w-0 flex-1 line-clamp-3 text-xs leading-[1.5]',
                              active ? 'font-medium text-text-primary' : 'text-text-secondary',
                            )}
                          >
                            {incident.description}
                          </span>
                        </span>

                        {/*
                          One line of context, in the order a desk asks: how bad,
                          how trustworthy the capture, where it has got to.

                          The severity badge is the only colour on the row, so
                          urgency is what the eye catches down the column — which
                          is what the ordering is for.
                        */}
                        <span className="mt-2 flex flex-wrap items-center gap-1.5">
                          <SeverityBadge severity={incident.severity} />
                          <AssuranceBadge assurance={incident.assurance} showLabel={false} />
                          <VerificationBadge state={s} />
                          <NewsValueChip assessment={assessments[incident.id]} />
                          {/* Already a top story — so the next one is chosen knowing that. */}
                          {(leads[incident.id]?.lead ?? incident.lead) ? (
                            <span className="rounded-pill bg-accent-wash px-1.5 text-2xs font-medium text-accent">
                              Leading
                            </span>
                          ) : null}
                        </span>

                        {/*
                          When and where, on the row rather than one click in.

                          Both were only on the case pane, so choosing what to
                          open next meant opening things to find out. The
                          relative age answers how stale — never what morning,
                          and never where, which is how a desk sweeps a day's
                          intake.

                          Absent rather than placeheld: a reporter who withheld
                          the date or the location did so deliberately, and
                          "Unknown" advertises that there was something to hide.
                        */}
                        <span className="mt-1.5 flex items-center gap-1.5 text-2xs text-text-faint">
                          {when ? <span className="shrink-0">{when}</span> : null}
                          {when && where ? <span aria-hidden>·</span> : null}
                          {where ? (
                            <span className="min-w-0 truncate" title={where}>
                              {where}
                            </span>
                          ) : null}
                          <span className="ml-auto shrink-0 tabular">
                            {formatRelativeTime(incident.capturedAtIso) ?? ''}
                          </span>
                        </span>
                      </button>
                      <span className="mx-3.5 block h-px bg-hairline/[0.05]" />
                    </li>
                  );
                })}
              </ul>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Case ──────────────────────────────────────────────────────────
        Two columns, because a verification desk is two jobs.

        This was one 768px column of eight stacked panels in a viewport nearly
        twice that wide — so everything was a scroll, and the worst of it was
        the order. Corroboration *gates* the decision, and the decision sat
        below two large scoring panels: deciding meant scrolling down, being
        refused for insufficient corroboration, scrolling back up to tick, and
        scrolling down again. On every report in a queue of forty-five.

        Evidence left, judgement right, and the judgement column is sticky. An
        editor watches the footage and works the checklist without the decision
        ever leaving the screen — which is also the order the work happens in.
      */}
      {/*
        `min-w-0` is load-bearing, not tidiness.

        A flex item's automatic minimum size is its *min-content* width, so
        `flex-1` alone will not let this pane shrink below what its content
        demands. While the inner column was capped at `max-w-3xl` that cap was
        also the cap on its min-content contribution, and nothing showed. Raising
        the cap let the case pane push wider than its share of the row — and
        because `overflow-y-auto` computes `overflow-x` to `auto`, the result was
        a horizontal scrollbar and a rating row with its last button cut off.
      */}
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
        {/*
          What this report is, across the full width.

          It sat inside the evidence column, so the rail beside it began level
          with the headline and the checklist started a paragraph lower than the
          footage it is checked against. Above both columns, the two halves of
          the case start on the same line.
        */}
        <div className="mx-auto max-w-[1500px] px-6 pt-5">
          <CaseHeader incident={selected} state={state} />
        </div>

        <div
          className={cn(
            'mx-auto flex max-w-[1500px] flex-col gap-5 px-6 pb-6 pt-4',
            /*
              The split is tied to the queue, not to a guessed viewport.

              Measured rather than hoped: navigation is a top bar, so a 300px
              queue and a 20rem rail leave the evidence about 600px from `xl`
              with the queue open, and from `lg` with it closed. `2xl` needed
              1536 and a desk at 125% scaling sat just under it — so the
              decision, which gates nothing if it is off the screen, ended up
              below everything else.
            */
            queueOpen ? 'xl:flex-row xl:items-start' : 'lg:flex-row lg:items-start',
          )}
        >
          {/* ── Evidence ────────────────────────────────────────────────── */}
          <div className="min-w-0 flex-1 space-y-4">
            <CaseTabs
              value={tab}
              onChange={setTab}
              unrated={activeNewsValue.unassessed.length}
              contacts={activeCase.contacts.length}
            />

            {/*
              The footage, actually playing.

              This passed only `posterUrl`, and the service stores that as null
              for every video — so the one screen whose entire job is looking at
              the footage showed a black rectangle. An editor was being asked to
              rule on whether something could be called verified without being
              able to watch it.

              **Through this console, not straight at the service.** The signed
              media URL is good for about five minutes; this page is rendered once
              and then worked for as long as the queue takes. An editor five
              minutes in was shown "The file could not be opened" on every report
              they clicked. `mediaHref` carries no signature and cannot go stale.
            */}
            {tab === 'evidence' ? (
              <>
                <MediaFrame
                  /*
                    The service's 1280px JPEG: the photo itself, or a video's
                    poster. The default media for a video is the MP4, which an
                    `<img>` cannot draw, and a photo's original is megabytes the
                    frame does not need. Older reports without copies fall back
                    to the photo on the service's side.
                  */
                  {...(selected.media.kind === 'video'
                    ? /*
                        No still, and no request for one. This service stores
                        `posterUrl`, `thumbUrl` and `viewUrl` as null for every
                        clip it holds, so `?v=view` on a video was a guaranteed
                        404 — one per report, in the network tab of the very
                        screen where somebody is trying to work out why the
                        footage will not play. The player draws its own first
                        frame, which is what it did anyway.
                      */
                      { videoUrl: mediaHref(selected.id) }
                    : { posterUrl: mediaHref(selected.id, 'view') })}
                  alt={selected.description}
                  when={formatExactCapture(selected.capturedAtIso, selected.capturedAtPrecision)}
                  /*
                    The fix when the service named no place — which is every report it
                    holds. Reading `label` alone stamped a time and nothing else onto
                    footage whose whole claim is that it was taken somewhere specific.
                  */
                  where={formatPlace(selected.location)}
                  isVideo={selected.media.kind === 'video'}
                  byteSize={selected.media.byteSize}
                  /*
                    Lower than the frame's own cap. Beside a rail and under a
                    header, 62% of the viewport left the assurance note below the
                    fold; the footage is still the largest thing on the screen.
                  */
                  className="max-h-[54vh]"
                />

                <HandlingNotice handling={selected.handling} />

                {/* Why this class, in the reviewer's terms. */}
                <Panel className="p-4">
                  <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
                    Capture assurance
                  </p>
                  <p className="mt-1.5 text-xs leading-relaxed text-text-secondary">
                    {assuranceMeta(selected.assurance).description}
                  </p>
                  {!assuranceMeta(selected.assurance).usableAlone ? (
                    <p className="mt-2 rounded-sm bg-warning-wash/40 px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
                      Cannot stand alone. Something independent of the reporter is required before
                      this may be described as verified.
                    </p>
                  ) : null}
                </Panel>
              </>
            ) : null}

            {/*
              Placed after the evidence and beside the decision, which is the order
              the decisions are actually made in: establish what stands up, then
              decide how big it is, then decide whether it runs. Putting it above
              corroboration would invite an editor to rank a story before knowing
              whether any of it is true.

              Two panels, side by side, because they are two different kinds of
              claim. The left is derived from the record and cannot be edited —
              there is no control in it to press. The right is a person's
              judgement. They were one panel with the derived number reduced to a
              clause inside it, which made the desk's own assessment and the
              machine's indistinguishable at a glance.

              Narrow-fixed left, flexible right: the automatic panel is a score
              and two short lists, while the editor's carries ten rating rows
              that need the width. They stack until 1700px, because below that
              the evidence column is sharing the viewport with the queue and the
              judgement rail and has nothing to spare.
            */}
            {/*
              `grid-cols-1` is the fix for the sideways scroll, and it is not
              cosmetic.

              A grid with no column template gets one implicit `auto` track,
              and an `auto` track's minimum is the largest *min-content* width
              among its items — so a panel that will not shrink drags the track
              wider than the container and the whole pane scrolls sideways.
              Tailwind's `grid-cols-1` is `repeat(1, minmax(0, 1fr))`, and that
              `0` is the entire point: it lets the track be narrower than its
              contents so the panels truncate instead of pushing.

              The same reason `minmax(0,1fr)` is spelled out on the wide
              template rather than written as `1fr`.
            */}
            {tab === 'value' ? (
              <div className="grid grid-cols-1 gap-4 min-[1700px]:grid-cols-[15rem_minmax(0,1fr)] min-[1700px]:items-start">
                <AutomaticScorePanel assessment={assessment} region={assessment.region} />
                <NewsValuePanel
                  state={activeNewsValue}
                  region={assessment.region}
                  provisionalScore={assessment.score.score}
                  saveState={saveState}
                  onChange={(next) => {
                    setNewsValue((prev) => ({ ...prev, [selected.id]: next }));
                    saveNewsValue(selected.id, next);
                  }}
                />
              </div>
            ) : null}

            {tab === 'contact' ? <ContactLog contacts={activeCase.contacts} /> : null}
          </div>

          {/* ── Judgement ───────────────────────────────────────────────────
            Sticky, and narrow on purpose.

            Everything here either gates the decision or is the decision, so it
            has to stay on screen while the editor is looking at the evidence
            that informs it. `top-5` clears the page padding; the height cap and
            its own scroll stop a long checklist from pushing the decision back
            below the fold, which would reproduce the bug this layout exists to
            end.
          */}
          <div
            className={cn(
              'w-full shrink-0 space-y-4',
              /*
                The height cap takes the 3.5rem top bar off the viewport as well
                as the padding, or the bottom of the decision sits under the fold.
              */
              queueOpen
                ? 'xl:sticky xl:top-5 xl:max-h-[calc(100vh-6rem)] xl:w-[20rem] xl:overflow-y-auto xl:pb-4'
                : 'lg:sticky lg:top-5 lg:max-h-[calc(100vh-6rem)] lg:w-[20rem] lg:overflow-y-auto lg:pb-4',
            )}
          >
            <CorroborationPanel
              completed={activeCase.corroboration.completed}
              onToggle={toggleCheck}
              failure={checkError}
            />

            {/*
            The other half of an editor's job, and the one nothing offered.

            A report no organisation licensed is not published by anybody —
            there is no org to credit it to — so without this it is simply
            buried. The control used to sit on the platform owner's routing
            desk, where the API refuses it: `/editorial/{id}/transition`
            answers 403 for an owner, and middleware keeps editors off
            `/platform/*` entirely, so the person allowed to do it could never
            reach the button.
          */}
            {/*
              Read off the record rather than added to `Incident`.

              The server sends `destination` on every editorial item, and the
              shared type does not claim it — asserting a field on a type the
              phone also compiles against would be inventing a contract neither
              client has verified. This is the same treatment `normaliseRouting`
              gives the fields the routing queue sends beyond `RoutingItem`.
            */}
            <ReleasePanel
              destination={(selected as { destination?: SubmissionDestination }).destination}
            />

            {/*
              Whether it leads the feed — the editor's call, separate from the
              verification. Keyed on the report so the expiry choice does not
              carry from one case to the next.
            */}
            <LeadPanel
              key={selected.id}
              incidentId={selected.id}
              published={selected.vettingState === 'published' || published?.id === selected.id}
              section={
                published?.id === selected.id
                  ? (published.section ?? selected.section ?? null)
                  : (selected.section ?? null)
              }
              state={
                leads[selected.id] ?? {
                  lead: selected.lead ?? false,
                  leadAt: selected.leadAt ?? null,
                  leadUntil: selected.leadUntil ?? null,
                }
              }
              onChange={(next) => setLeads((prev) => ({ ...prev, [selected.id]: next }))}
            />

            <DecisionPanel
              state={state}
              assurance={selected.assurance}
              corroboration={activeCase.corroboration}
              editorName={editorName}
              history={activeCase.decisions}
              publishes={
                (selected as { destination?: SubmissionDestination }).destination === 'public' ||
                (selected as { destination?: SubmissionDestination }).destination === 'both'
              }
              onDecide={(to, reason, section, lead) => {
                /*
                 * Sent, then shown.
                 *
                 * This was `setStates` alone: the badge changed, the history grew
                 * a row, and the platform was told nothing — so an editor could
                 * work a queue of nineteen and change none of it, with a reload
                 * putting everything back. The local state now moves only after
                 * the server has accepted the transition.
                 */
                void (async () => {
                  setDecisionError(null);
                  try {
                    const id = encodeURIComponent(selected.id);
                    const res = await fetch(`/api/editorial/${id}`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      // `lead` only when the editor ticked it; absent leaves any lead as it is.
                      body: JSON.stringify({
                        action: 'decide',
                        to,
                        reason,
                        section,
                        ...(lead ? { lead: true } : {}),
                      }),
                    });
                    if (res.ok && lead) {
                      // Shown as leading at once; the Top story panel can change it.
                      setLeads((prev) => ({
                        ...prev,
                        [selected.id]: { lead: true, leadAt: new Date().toISOString(), leadUntil: null },
                      }));
                    }
                    if (!res.ok) {
                      const answer = (await res.json()) as {
                        error?: string;
                        upstreamStatus?: number;
                      };
                      setDecisionError(
                        answer.error
                          ? `${answer.error}${answer.upstreamStatus ? ` (${answer.upstreamStatus})` : ''}`
                          : 'That decision could not be recorded.',
                      );
                      return;
                    }

                    /*
                     * Whether that decision published it, from the answer.
                     *
                     * Publishing used to be a silent side effect — the response
                     * said nothing about it, so an editor recorded a verification
                     * and had no way of knowing that the footage was now in front
                     * of every user of the app. It carries `published`,
                     * `publishedAt` and `section` now, and there is no reason for
                     * the person who did it to be the last to find out.
                     */
                    const answer = (await res.json()) as {
                      result?: { published?: boolean; section?: string | null };
                    };
                    setPublished(
                      answer.result?.published
                        ? { id: selected.id, section: answer.result.section ?? null }
                        : null,
                    );
                  } catch {
                    setDecisionError(
                      'The console could not reach its own server. Nothing was recorded.',
                    );
                    return;
                  }

                  setStates((prev) => ({ ...prev, [selected.id]: to }));
                  setLive((prev) => {
                    const current = prev[selected.id] ?? activeCase;
                    return {
                      ...prev,
                      [selected.id]: {
                        ...current,
                        decisions: [
                          ...current.decisions,
                          {
                            id: `dr_${Date.now()}`,
                            from: state,
                            to,
                            editorName,
                            reason,
                            decidedAtIso: new Date().toISOString(),
                          },
                        ],
                      },
                    };
                  });
                })();
              }}
            />
            {decisionError ? (
              <p className="rounded-md border border-danger/25 bg-danger-wash p-3 text-xs leading-relaxed text-danger">
                {decisionError}
              </p>
            ) : null}

            {/*
              The consequence of the decision, said once.

              Verifying a public report is what publishes it, and until the
              transition response carried `published` there was nothing on this
              screen that said so — an editor recorded a judgement about whether
              something was true and was never told it had just gone in front of
              everybody. Scoped to the selected report so it cannot linger over
              the next one in the queue.
            */}
            {published?.id === selected.id ? (
              <p className="flex items-start gap-2 rounded-md border border-success/25 bg-success-wash/40 p-3 text-xs leading-relaxed text-text-secondary">
                <Globe className="mt-px h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2} />
                <span>
                  <span className="font-semibold text-text-primary">
                    Published to the public feed.
                  </span>{' '}
                  It is in the app for everyone now
                  {published.section ? `, on the ${published.section} desk` : ''}.
                </span>
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * What this report is, and what is being claimed about it.
 *
 * The old header was a mono reference chip, three badges and a paragraph — the
 * same weight as any other panel on the page, so nothing said *this is the
 * thing you are deciding about*. The description, which is the only sentence a
 * human wrote, was set at the same size as the surrounding furniture.
 *
 * So: the description leads, at a size worth reading. The reference and the
 * capture facts drop to a quiet meta line beneath it, because they are things
 * an editor looks *up*, not things they read. And the permitted representation
 * — the one line with legal weight on this screen — gets its own bordered
 * block instead of being italic small print at the bottom.
 */
function CaseHeader({ incident, state }: { incident: Incident; state: VerificationState }) {
  const when = formatExactCapture(incident.capturedAtIso, incident.capturedAtPrecision);
  const where = formatPlace(incident.location);
  const meta = verificationMeta(state);
  const failures = failedCheckDetails(incident.captureChecks);

  return (
    <header>
      <div className="flex flex-wrap items-center gap-2">
        <SeverityBadge severity={incident.severity} />
        <AssuranceBadge assurance={incident.assurance} />
        <VerificationBadge state={state} />
        <span className="ml-auto shrink-0 font-mono text-2xs text-text-faint">
          {incident.reportId}
        </span>
      </div>

      <h1 className="mt-3 text-xl font-semibold leading-snug text-text-primary">
        {incident.description}
      </h1>

      {/*
        The facts a reference is looked up *for*, on one line and in the order
        somebody asks them: what kind of thing, when, where, how long it has
        been waiting. These were scattered across the media stamp, the queue row
        and nowhere.
      */}
      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-text-muted">
        <span className="flex items-center gap-1.5">
          <MediaKindMark kind={incident.media.kind} />
          {categoryLabel(incident.category)}
        </span>
        {when ? (
          <span className="flex items-center gap-1">
            <Clock className="h-2.5 w-2.5" strokeWidth={2} />
            {when}
          </span>
        ) : null}
        {where ? (
          <span className="flex min-w-0 items-center gap-1" title={where}>
            <MapPin className="h-2.5 w-2.5 shrink-0" strokeWidth={2} />
            <span className="truncate">{where}</span>
          </span>
        ) : null}
      </div>

      {/*
        The claim the interface is permitted to make, given the state.

        This is a legal exposure rather than a copy decision — "capture
        integrity verified" and "event verified" are different assertions — and
        it was italic 11px at the bottom of a paragraph, which is where a
        product puts something it hopes nobody reads.
      */}
      <p
        className="mt-3 border-l-2 py-0.5 pl-3 text-xs leading-relaxed text-text-secondary"
        style={{ borderColor: meta.hue }}
      >
        {meta.permittedRepresentation}
      </p>

      {/*
        Which check failed — and this screen is the only place it may appear.

        **The permitted representation for `integrity_flagged` is "Show the
        specific flag to authorised reviewers only", and until now it was shown
        to nobody.** The service has sent all eight booleans on every incident
        since the beginning and the console read none of them, so an editor was
        told a report had failed *something* and never what — and clearing a
        flag you cannot see is not a decision, it is a guess. That is the whole
        job this desk exists to do.

        A licensee still sees only that it is flagged. The distinction is the
        rule, not an oversight: some of these describe the reporter's own
        device, and the flag is an internal signal rather than a claim about
        the footage.

        Each one carries what it means, because the label alone does not decide
        anything. "Device clock disagreed with server time" could be an unsynced
        phone or a back-dated file, and those lead opposite ways.
      */}
      {failures.length > 0 ? (
        <div className="mt-3 rounded-sm border border-warning/30 bg-warning-wash/30 p-3">
          <p className="flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-wider text-text-secondary">
            <AlertTriangle className="h-3 w-3" strokeWidth={2.5} />
            {failures.length === 1 ? 'Check that failed' : `${failures.length} checks failed`}
          </p>
          <ul className="mt-2 space-y-2">
            {failures.map((check) => (
              <li key={check.id}>
                <p className="text-xs font-medium text-text-primary">{check.label}</p>
                <p className="mt-0.5 text-2xs leading-relaxed text-text-muted">{check.meaning}</p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </header>
  );
}

/**
 * The provisional news value, small enough to read as provisional.
 *
 * The tier rather than the number, because a queue is scanned and "Top five"
 * carries the meaning that 312 has to be decoded into. The score is in the
 * tooltip for anybody comparing two rows.
 *
 * Neutral colours throughout. A lead-story chip in green beside an unverified
 * report would be the platform recommending something it has not checked.
 */
/* ── grouping the queue ──────────────────────────────────────────────────── */

type Grouping = 'urgency' | 'date' | 'subject';

/** Which end of the calendar the date view starts at. */
type DateOrder = 'newest' | 'oldest';

const DATE_ORDERS: { value: DateOrder; label: string; title: string }[] = [
  { value: 'newest', label: 'Newest first', title: 'Today at the top' },
  { value: 'oldest', label: 'Oldest first', title: 'The longest-waiting day at the top' },
];

const GROUPINGS: { value: Grouping; label: string; title: string }[] = [
  { value: 'urgency', label: 'Urgency', title: 'One list, most urgent first' },
  { value: 'date', label: 'Date', title: 'Grouped by the day it was filmed' },
  { value: 'subject', label: 'Subject', title: 'Grouped by category' },
];

interface QueueEntry {
  incident: Incident;
  score: number;
}

interface QueueGroup {
  key: string;
  /** Null on the ungrouped view, so no heading is drawn at all. */
  label: string | null;
  items: QueueEntry[];
}

/**
 * Break the queue into sections without re-ranking it.
 *
 * **Order inside a group is always triage.** The queue's ordering is a claim
 * about what needs attention next, and a grouping that re-sorted by date would
 * quietly answer a different question under the same list — an editor working
 * top-down would start on the newest thing rather than the most urgent, with
 * nothing on screen saying so.
 *
 * Groups themselves are ordered by their most urgent member, for the same
 * reason: whichever way the list is cut, the first row an editor sees is the
 * one the desk would have given them anyway.
 *
 * A missing date is its own group rather than the bottom of another. A report
 * whose capture date the reporter withheld is a real report and has to be
 * findable; folding it into "Today" would assert a date nobody gave.
 */
function groupQueue(queue: QueueEntry[], grouping: Grouping, order: DateOrder): QueueGroup[] {
  if (grouping === 'urgency') return [{ key: 'all', label: null, items: queue }];

  const buckets = new Map<string, QueueGroup>();

  for (const entry of queue) {
    const { key, label } =
      grouping === 'date'
        ? {
            key: entry.incident.capturedAtIso?.slice(0, 10) ?? 'undated',
            label: formatCaptureDay(entry.incident.capturedAtIso) ?? 'No date given',
          }
        : { key: entry.incident.category, label: categoryLabel(entry.incident.category) };

    const bucket = buckets.get(key);
    if (bucket) bucket.items.push(entry);
    else buckets.set(key, { key, label, items: [entry] });
  }

  const groups = [...buckets.values()];

  /*
   * Dates run by date, and the editor says which way.
   *
   * Ranking date groups by their most urgent member — the rule the subject view
   * uses — put **4 September at the top of a queue opened on the 10th**, because
   * triage counts waiting time and the oldest report is by definition the one
   * that has waited longest. Arithmetically right, and the opposite of what
   * "group by date" is for: an editor picking Date wants a day, and the day
   * they almost always want is today.
   *
   * The key is `YYYY-MM-DD`, so it sorts as a string with no parsing.
   *
   * Undated last either way. A report whose capture date the reporter withheld
   * belongs to no day, and putting it at the top of "newest" would assert that
   * it is the most recent thing on the desk.
   */
  if (grouping === 'date') {
    return groups.sort((a, b) => {
      if (a.key === 'undated') return 1;
      if (b.key === 'undated') return -1;
      return order === 'newest' ? b.key.localeCompare(a.key) : a.key.localeCompare(b.key);
    });
  }

  // Subjects keep the triage ranking: there is no natural order to categories,
  // so the most urgent one leading is the answer that means something.
  // `queue` arrives sorted, so the first item of every bucket is its most
  // urgent and no second sort is needed to rank the groups.
  return groups.sort((a, b) => (b.items[0]?.score ?? 0) - (a.items[0]?.score ?? 0));
}

/**
 * Which way the days run.
 *
 * Only under the date view, because it is the only grouping with an order of
 * its own — a category has no natural direction, and offering "newest
 * categories" would be a control that means nothing.
 */
function DateOrderPicker({
  value,
  onChange,
}: {
  value: DateOrder;
  onChange: (next: DateOrder) => void;
}) {
  /*
   * One button that flips, beside the grouping rather than on a row of its own.
   * Two labelled halves did not fit next to three grouping options in a 300px
   * queue, and a second row of controls is height taken from the list.
   */
  const current = DATE_ORDERS.find((option) => option.value === value) ?? DATE_ORDERS[0]!;
  const next: DateOrder = value === 'newest' ? 'oldest' : 'newest';

  return (
    <button
      type="button"
      onClick={() => onChange(next)}
      title={`${current.title} — click for ${next === 'newest' ? 'newest' : 'oldest'} first`}
      aria-label={`${current.label}. Switch to ${next} first`}
      className="flex shrink-0 items-center gap-1 rounded-sm bg-canvas-raise/60 px-2 py-1.5 text-2xs font-medium text-text-secondary transition hover:text-text-primary"
    >
      <ArrowDownUp className="h-3 w-3 text-text-faint" strokeWidth={2} />
      {value === 'newest' ? 'Newest' : 'Oldest'}
    </button>
  );
}

function GroupPicker({ value, onChange }: { value: Grouping; onChange: (next: Grouping) => void }) {
  return (
    <div className="flex gap-0.5 rounded-sm bg-canvas-raise/60 p-0.5" role="group">
      {GROUPINGS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          title={option.title}
          className={cn(
            'flex-1 rounded-xs px-2 py-1 text-2xs font-medium transition',
            value === option.value
              ? 'bg-canvas text-text-primary shadow-sm'
              : 'text-text-muted hover:text-text-secondary',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Footage, a still, or a recording — in one glyph.
 *
 * Not decoration: it changes what the row costs to work. A clip has to be
 * watched end to end before anything can be said about it, a photograph is read
 * at a glance, and audio cannot be judged with the sound off. The row carried
 * no sign of which, so an editor picking the next item could not tell a
 * two-second job from a two-minute one.
 */
function MediaKindMark({ kind }: { kind: Incident['media']['kind'] }) {
  const Icon = kind === 'video' ? Video : kind === 'audio' ? Mic : ImageIcon;
  const label = kind === 'video' ? 'Video' : kind === 'audio' ? 'Audio' : 'Photo';

  return (
    <span
      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-xs bg-canvas-raise text-text-muted"
      title={label}
      aria-label={label}
    >
      <Icon className="h-2.5 w-2.5" strokeWidth={2} />
    </span>
  );
}

function NewsValueChip({ assessment }: { assessment: ProvisionalAssessment | undefined }) {
  if (!assessment) return null;
  const tier = NEWS_TIER_META[assessment.score.tier];

  return (
    <span
      className="rounded-pill bg-canvas-raise px-1.5 text-2xs text-text-muted"
      title={`${assessment.score.score} of 500 from the record alone — ${assessment.unassessed.length} of 10 criteria still need an editor.`}
    >
      {tier.label}
    </span>
  );
}

function CorroborationPanel({
  completed,
  onToggle,
  failure,
}: {
  completed: CorroborationCheckId[];
  onToggle: (id: CorroborationCheckId) => void;
  /**
   * The tick that did not take, and why.
   *
   * Passed down rather than kept here because the request lives with the rest
   * of the desk's writes — but it has to be *rendered* here, next to the box
   * that reverted. It used to surface in the decision panel several hundred
   * pixels below, which on a full checklist is off the screen entirely.
   */
  failure: { id: CorroborationCheckId; message: string } | null;
}) {
  const record = { completed, notes: null };
  const strength = corroborationStrength(record);
  const independent = hasIndependentCorroboration(record);

  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
          Corroboration
        </p>
        <span className="tabular text-2xs text-text-muted">{Math.round(strength * 100)}%</span>
      </div>

      <div className="mt-2 h-1 overflow-hidden rounded-pill bg-canvas-raise">
        <div
          className={cn('h-full rounded-pill', strength >= 0.5 ? 'bg-success' : 'bg-accent')}
          style={{ width: `${Math.round(strength * 100)}%` }}
        />
      </div>

      {/*
        What is still missing, named.
      
        The bar showed a percentage and left the editor to work out what it had
        to reach — so the only way to discover the threshold was to tick boxes
        until the decision stopped being refused. Both requirements are in
        `@dawuro/core`, so the panel can simply say them: half the available
        weight, and at least one check independent of the reporter.
      
        Phrased as the shortest way to finish rather than as a scolding. An
        editor who needs one more independent check should be told which ones
        those are, not that they have failed a rule.
      */}
      <p className="mt-2 text-2xs leading-relaxed text-text-muted">
        {strength >= 0.5 && independent ? (
          <span className="text-success">Enough to record as verified.</span>
        ) : (
          <>
            <span className="text-text-secondary">Still needed for full verification:</span>{' '}
            {[
              strength < 0.5 ? `${Math.round((0.5 - strength) * 100)}% more` : null,
              !independent ? 'one check independent of the reporter' : null,
            ]
              .filter(Boolean)
              .join(', ')}
            .
          </>
        )}
      </p>

      {/*
        The failure, where the failure happened.

        A tick that reverts with its explanation three panels down is a box that
        unticks itself for no reason anybody can see — which is how this was
        reported. It names the check as well, because an editor working through
        seven of them needs to know which one did not take.
      */}
      {failure ? (
        <p className="mt-3 rounded-sm border border-danger/25 bg-danger-wash/40 p-2.5 text-2xs leading-relaxed text-danger">
          <span className="font-medium">
            {CORROBORATION_CHECKS.find((c) => c.id === failure.id)?.label ?? 'That check'} was not
            recorded.
          </span>{' '}
          {failure.message}
        </p>
      ) : null}

      <ul className="mt-3 space-y-1.5">
        {CORROBORATION_CHECKS.map((check) => {
          const done = completed.includes(check.id);
          return (
            <li key={check.id}>
              <button
                type="button"
                onClick={() => onToggle(check.id)}
                aria-pressed={done}
                className="flex w-full items-start gap-2.5 rounded-sm px-2 py-1.5 text-left transition hover:bg-canvas-raise/50"
              >
                <span
                  className={cn(
                    'mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-xs border',
                    done ? 'border-success bg-success' : 'border-hairline/25',
                  )}
                >
                  {done ? (
                    <Check className="h-2.5 w-2.5 text-text-on-dark" strokeWidth={3.5} />
                  ) : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="text-xs font-medium">{check.label}</span>
                    {check.independent ? (
                      <span className="rounded-pill bg-info-wash px-1.5 text-2xs text-info">
                        independent
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-px block text-2xs text-text-muted">{check.description}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </Panel>
  );
}

function ContactLog({ contacts }: { contacts: EditorialCase['contacts'] }) {
  return (
    <Panel className="p-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
        Source contact
      </p>
      {contacts.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">Nobody has tried to reach the reporter yet.</p>
      ) : (
        <ul className="mt-2.5 space-y-2">
          {contacts.map((c) => (
            <li key={c.id} className="flex items-start gap-2.5">
              {c.outcome === 'reached' ? (
                <Phone className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" strokeWidth={2.2} />
              ) : (
                <PhoneOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" strokeWidth={2} />
              )}
              <div className="min-w-0 flex-1 text-xs">
                <p>
                  <span className="font-medium capitalize">{c.method}</span>{' '}
                  <span className="text-text-muted">— {c.outcome.replace('_', ' ')}</span>
                </p>
                {c.note ? <p className="mt-px text-text-muted">{c.note}</p> : null}
                <p className="mt-px text-2xs text-text-faint">
                  {c.byEditorName} · {formatRelativeTime(c.attemptedAtIso) ?? ''}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
      <Button variant="secondary" size="sm" className="mt-3">
        <Phone className="h-3.5 w-3.5" /> Log an attempt
      </Button>
    </Panel>
  );
}

function DecisionPanel({
  state,
  assurance,
  corroboration,
  editorName,
  history,
  publishes,
  onDecide,
}: {
  state: VerificationState;
  assurance: Parameters<typeof decisionProblem>[3];
  corroboration: Parameters<typeof decisionProblem>[2];
  editorName: string;
  history: EditorialCase['decisions'];
  /** True when this decision would put the report on the public feed. */
  publishes: boolean;
  onDecide: (to: VerificationState, reason: string, section: NewsSection, lead: boolean) => void;
}) {
  const [target, setTarget] = useState<VerificationState | null>(null);
  const [reason, setReason] = useState('');
  /** Publish and lead the feed in one step. Off unless the editor asks. */
  const [lead, setLead] = useState(false);
  /*
   * Which desk it runs on.
   *
   * The service defaults to Ghana, and for a citizen report filed in Accra that
   * is nearly always right — so Ghana is preselected rather than the editor
   * being made to answer a question with an obvious answer. It is offered at
   * all because the desk is the editor's to choose: nothing reaches Latest or
   * Africa or Organisation except by somebody putting it there.
   */
  const [section, setSection] = useState<NewsSection>('ghana');

  const options = nextStates(state);
  const problem = target ? decisionProblem(state, target, corroboration, assurance, reason) : null;

  return (
    <Panel className="p-4">
      <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">Decision</p>

      {options.length === 0 ? (
        <p className="mt-2 text-xs text-text-muted">
          This report is closed. Nothing further can be decided about it.
        </p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setTarget(target === option ? null : option)}
                aria-pressed={target === option}
                className={cn(
                  'rounded-pill border px-3 py-1.5 text-xs transition',
                  target === option
                    ? 'border-accent bg-accent-wash text-accent'
                    : 'border-hairline/12 text-text-muted hover:border-accent/30',
                )}
              >
                {VERIFICATION_META[option].label}
              </button>
            ))}
          </div>

          {target ? (
            <div className="mt-3.5">
              {/*
                Only where the decision actually publishes. On a report that
                stays exclusive, or a move that is not a release, a desk picker
                is a control that changes nothing — and one of those on a screen
                this consequential is worse than an absent option.
              */}
              {publishes && target === 'verified_high_confidence' ? (
                <div className="mb-3.5">
                  <p className="text-xs font-medium">Which desk?</p>
                  <p className="mt-0.5 text-2xs text-text-muted">
                    Where it runs in the app. A published report with no desk appears in no feed at
                    all.
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {NEWS_SECTIONS.map((option) => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => setSection(option)}
                        aria-pressed={section === option}
                        className={cn(
                          'rounded-pill border px-2.5 py-1 text-2xs capitalize transition',
                          section === option
                            ? 'border-accent bg-accent text-text-on-dark'
                            : 'border-hairline/15 text-text-muted hover:border-hairline/35',
                        )}
                      >
                        {option}
                      </button>
                    ))}
                  </div>

                  {/*
                    Publish and lead in one step — for the story that should be
                    at the top the moment it goes out. Off by default: most
                    verified reports join the feed in order, and a lead is a
                    choice somebody makes, not a side effect of verifying.
                  */}
                  <label className="mt-3 flex cursor-pointer items-start gap-2.5 rounded-sm px-1 py-1">
                    <input
                      id="decision-lead"
                      type="checkbox"
                      checked={lead}
                      onChange={(event) => setLead(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 accent-accent"
                    />
                    <span>
                      <span className="block text-xs font-medium">Also lead the feed</span>
                      <span className="mt-0.5 block text-2xs text-text-muted">
                        Puts it at the top of the {section} desk, ahead of newer reports, until an
                        editor clears it.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              <label htmlFor="decision-reason" className="text-xs font-medium">
                Why?
              </label>
              <p className="mt-0.5 text-2xs text-text-muted">
                Kept permanently against this report and shown in its history.
              </p>
              <textarea
                id="decision-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                className="mt-1.5 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 py-2 text-sm"
                placeholder="Two independent witnesses and the police log agree."
              />

              {/* The refusal explains itself. A disabled button with no reason
                  teaches an editor to distrust the tool. */}
              {problem ? (
                <p className="mt-2 rounded-sm bg-warning-wash/45 px-2.5 py-2 text-2xs leading-relaxed text-text-secondary">
                  {PROBLEM_COPY[problem]}
                </p>
              ) : null}

              <Button
                className="mt-3"
                disabled={problem !== null}
                onClick={() => {
                  // A lead only rides along where this decision actually publishes.
                  onDecide(
                    target,
                    reason.trim(),
                    section,
                    lead && publishes && target === 'verified_high_confidence',
                  );
                  setTarget(null);
                  setReason('');
                  setLead(false);
                }}
              >
                Record as {VERIFICATION_META[target].label.toLowerCase()}
              </Button>
            </div>
          ) : null}
        </>
      )}

      {history.length > 0 ? (
        <div className="mt-4 border-t border-hairline/[0.07] pt-3.5">
          <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
            History
          </p>
          <ul className="mt-2 space-y-2">
            {history.map((d) => (
              <li key={d.id} className="text-xs">
                <p>
                  <span className="text-text-muted">{verificationMeta(d.from).label}</span>
                  <span className="mx-1.5 text-text-faint">→</span>
                  <span className="font-medium">{verificationMeta(d.to).label}</span>
                </p>
                <p className="mt-px text-text-muted">{d.reason}</p>
                <p className="mt-px text-2xs text-text-faint">
                  {d.editorName} · {formatRelativeTime(d.decidedAtIso) ?? ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <p className="mt-3 flex items-center gap-1.5 border-t border-hairline/[0.07] pt-3 text-2xs text-text-faint">
        <Users className="h-3 w-3" /> Signed in as {editorName}
      </p>
    </Panel>
  );
}
