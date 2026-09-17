import { Globe, Lock } from 'lucide-react';
import type { SubmissionDestination } from '@dawuro/core';

/**
 * How a report reaches the public feed, and when it must not.
 *
 * **Verifying it is what publishes it.** Established against the live service,
 * end to end, with a real editor account:
 *
 *   record corroboration  ->  transition to `verified_high_confidence`
 *   ->  `vettingState: 'published'`, `publishedAt` set
 *   ->  the report appears in `/incidents` and `/newsroom/items`
 *       for an ordinary phone account.
 *
 * There is no separate publish button, and there should not be: the decision
 * that puts somebody's footage in front of the public is the same decision that
 * says it has been verified.
 *
 * **The exclusivity bug is fixed, and this panel changed with it.** A reporter
 * choosing `directed` is told "only the ones you choose receive it. Exclusive",
 * and `SubmissionDestination` records it as "Sent to named organisations only.
 * Never appears publicly." The service used to publish those anyway — a
 * decision about whether something was *true* silently overrode the reporter's
 * decision about who may *see* it, for somebody who had filmed at real risk on
 * the promise of a restricted audience. This panel carried a red warning about
 * it, because an editor doing that unknowingly is a different thing from an
 * editor breaking a promise.
 *
 * `POST /editorial/{id}/transition` now states the rule outright: "Sets
 * vettingState to published only when destination is public or both;
 * directed/marketplace stays exclusive." So the warning is gone. **Leaving it
 * would have been worse than never writing it** — a red banner on a screen that
 * no longer has the problem is how an editor learns to read past the real ones.
 */
export function ReleasePanel({ destination }: { destination?: SubmissionDestination }) {
  const goesPublic = destination === 'public' || destination === 'both';
  const exclusive = destination === 'directed' || destination === 'marketplace';

  if (exclusive) {
    return (
      <div className="rounded-md border border-hairline/[0.08] bg-canvas-raise p-4">
        <p className="flex items-center gap-2 text-xs font-medium text-text-secondary">
          <Lock className="h-3.5 w-3.5 text-text-muted" strokeWidth={2} />
          Stays exclusive — verifying will not publish it
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
          {destination === 'directed'
            ? 'The reporter sent this to named organisations only and was told it would never appear publicly.'
            : 'The reporter offered this to subscribing organisations rather than to the public feed.'}{' '}
          Recording a verification decision moves it through the editorial states and leaves it out
          of the public feed — the platform honours the destination.
        </p>
        <p className="mt-2 text-xs leading-relaxed text-text-muted">
          It reaches the public only if an organisation licenses it and chooses to release it,
          credited to themselves.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-md border border-info/25 bg-info-wash/30 p-4">
      <p className="flex items-center gap-2 text-xs font-medium text-text-secondary">
        <Globe className="h-3.5 w-3.5 text-info" strokeWidth={2} />
        Releasing to the public feed
      </p>
      {/*
        **"Corroborating" was the wrong word here, and a dangerous one.**
        `corroboration_in_progress` is where a report goes to *start* being
        checked — it is the state the checks above are done in, not a decision.
        Telling an editor that entering it publishes the footage either stops
        them beginning the work, or has them believe something is public when it
        is not. The state that publishes is the verification decision, which is
        what the note at the top of this file established end to end.
      */}
      <p className="mt-1.5 text-xs leading-relaxed text-text-muted">
        Recording this as <span className="font-medium text-text-secondary">Verified</span>{' '}
        publishes it.{' '}
        {goesPublic
          ? 'The reporter marked it for the public feed, so it appears in the app for everyone as soon as it reaches that decision — there is no separate release step.'
          : 'Check the destination above before deciding.'}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-text-muted">
        The corroboration checks above are what allow it: the platform refuses the decision until
        enough of them are recorded, and an independent one carries the most weight.
      </p>
      {/*
        A report published with no desk does not appear in the mobile feed at
        all — silently, with no error. The service now defaults it to Ghana
        rather than leaving it null, which is a real answer instead of a
        disappearance, but an editor should know which desk it lands on.
      */}
      <p className="mt-2 text-2xs leading-relaxed text-text-faint">
        It runs on the Ghana desk unless a section is chosen with the decision.
      </p>
    </div>
  );
}
