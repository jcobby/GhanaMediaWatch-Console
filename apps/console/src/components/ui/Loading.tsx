import { Panel } from './Panel';

/**
 * What a console page shows while its data is on the way.
 *
 * **There was nothing.** Every page here is a Server Component that fetches
 * before it renders, and the App Router will hold the *previous* page on screen
 * until the next one is ready unless a `loading.tsx` gives it something to
 * stream. With none anywhere in this app, clicking a nav item did nothing
 * visible for as long as the request took — and against a cold tunnel that is
 * several seconds. The queue you were looking at stayed put, so the click read
 * as ignored and the natural response is to click again.
 *
 * A skeleton rather than a spinner: these pages are lists and panels, and a
 * shape that matches what is coming makes the wait feel like loading rather
 * than like a stall. It also stops the layout jumping when the real rows land.
 *
 * `aria-busy` with a live region, because a screen reader gets no benefit from
 * grey rectangles.
 */
export function PageLoading({
  title,
  rows = 4,
}: {
  /** The page being loaded, so the header does not vanish and reappear. */
  title?: string;
  rows?: number;
}) {
  return (
    <div className="space-y-4" aria-busy="true" aria-live="polite">
      <div className="space-y-1.5">
        {title ? (
          <h1 className="text-lg font-semibold tracking-[-0.01em]">{title}</h1>
        ) : (
          <div className="h-5 w-48 animate-pulse rounded-sm bg-canvas-raise" />
        )}
        <p className="text-xs text-text-muted">Loading…</p>
      </div>

      <div className="space-y-2.5">
        {Array.from({ length: rows }, (_, i) => (
          <Panel key={i} className="p-4">
            <div className="flex items-start gap-3.5">
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-sm bg-canvas-raise" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3.5 w-1/3 animate-pulse rounded-xs bg-canvas-raise" />
                <div className="h-3 w-2/3 animate-pulse rounded-xs bg-canvas-raise" />
              </div>
              <div className="h-6 w-16 shrink-0 animate-pulse rounded-sm bg-canvas-raise" />
            </div>
          </Panel>
        ))}
      </div>
    </div>
  );
}

/**
 * The same idea for a two-pane desk — a queue beside one open item.
 *
 * The verification desk and the organisation inbox are both this shape, and a
 * single-column skeleton under them would reflow the moment the real layout
 * arrived.
 */
export function DeskLoading() {
  return (
    <div className="flex h-full gap-4" aria-busy="true" aria-live="polite">
      <div className="w-full max-w-xs shrink-0 space-y-2.5">
        <div className="h-4 w-24 animate-pulse rounded-xs bg-canvas-raise" />
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex gap-2.5 rounded-sm border border-hairline/[0.07] p-2.5">
            <div className="h-12 w-12 shrink-0 animate-pulse rounded-xs bg-canvas-raise" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-3 w-full animate-pulse rounded-xs bg-canvas-raise" />
              <div className="h-3 w-3/5 animate-pulse rounded-xs bg-canvas-raise" />
            </div>
          </div>
        ))}
      </div>

      <div className="min-w-0 flex-1 space-y-3">
        <div className="h-4 w-40 animate-pulse rounded-xs bg-canvas-raise" />
        <div className="h-6 w-3/4 animate-pulse rounded-sm bg-canvas-raise" />
        <div className="aspect-video w-full animate-pulse rounded-sm bg-canvas-raise" />
      </div>
    </div>
  );
}
