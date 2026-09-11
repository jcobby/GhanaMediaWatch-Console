import { AlertTriangle } from 'lucide-react';

/**
 * This screen's decisions do not leave the browser yet.
 *
 * Every action button in this console except the routing desk changes a React
 * state variable and nothing else. The row moves, the badge flips, the panel
 * closes — so the screen behaves exactly as it would if the platform had agreed.
 * An operator pressing "Release batch" watches a payout appear to go out, and
 * a reload brings it back.
 *
 * That is the worst failure this product can produce, because it is
 * indistinguishable from success at the moment it matters. This console's own
 * rule is that an outage must look like an outage; the same has to be true of
 * an action that was never sent.
 *
 * `what` names the specific decision, because "some things here don't work" is
 * not something anybody can act on. The button stays enabled on purpose: the
 * screens are being reviewed as designs, and disabling everything would hide
 * what the finished flow looks like. The banner is what stops it being a lie.
 *
 * Delete this from a screen the moment its actions call the server — and
 * `src/__tests__/wiring.test.ts` fails if one is left behind on a screen that
 * now writes, so a stale warning cannot outlive the thing it warns about.
 */
export function NotWired({ what }: { what: string }) {
  return (
    <div className="mx-7 mt-5 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-wash p-4">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
      <div className="min-w-0">
        <p className="text-xs font-semibold text-text-primary">Nothing here is saved yet</p>
        <p className="mt-1 text-xs leading-relaxed text-text-muted">
          {what} works on screen but is not sent to the service — it will be gone when you reload.
          Do not treat anything you do here as done.
        </p>
      </div>
    </div>
  );
}
