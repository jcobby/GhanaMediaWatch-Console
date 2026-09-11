import { AlertTriangle } from 'lucide-react';
import { Panel } from './ui';

/**
 * What a billing page shows when the plan could not be determined.
 *
 * These pages are entirely about money — a monthly fee, a charge per download,
 * what has been spent this period. Rendering any of them without a plan means
 * printing a number nobody can stand behind, and the tempting shortcuts are
 * both wrong: a zero reads as "free" and a default tier reads as "this is what
 * you are on". An organisation acting on either would be acting on a price the
 * console invented.
 *
 * So the page says it does not know, and says that the money is not affected by
 * the console not knowing — because the first question anybody reading this will
 * have is whether they are being charged something they cannot see.
 *
 * It is not an outage panel. The service answered; it simply did not name a
 * subscription tier this console recognises, which is a narrower and more
 * useful thing to be told.
 */
export function PlanUnavailable({ what }: { what: string }) {
  return (
    <Panel className="mx-auto my-10 max-w-xl p-8 text-center">
      <AlertTriangle className="mx-auto h-5 w-5 text-warning" strokeWidth={2} />
      <h2 className="mt-4 text-lg font-semibold text-text-primary">
        We cannot show your subscription
      </h2>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        Your account is working and your organisation is set up. What we could not establish is
        which subscription you are on, so {what} cannot be shown — every figure here is a price, and
        an invented one is worse than none.
      </p>
      <p className="mt-3 text-sm leading-relaxed text-text-muted">
        Nothing about your billing has changed and nothing is owed because of this. The rest of the
        console works as usual, and this page fills in on its own once your plan is readable.
      </p>
    </Panel>
  );
}
