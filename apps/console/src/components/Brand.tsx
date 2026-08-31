/* eslint-disable @next/next/no-img-element */

/**
 * Brand marks, in one place.
 *
 * Every surface that shows a logo goes through these components rather than
 * referencing a path directly, so replacing artwork is one edit here instead
 * of a hunt through the app.
 *
 * Plain `<img>` rather than `next/image`: these are fixed-size marks, never a
 * layout-shift risk, and the optimiser has little to do with a cropped PNG or
 * a vector.
 *
 * ## Provenance
 *
 * **PayDirect — official.** Supplied artwork, cropped to its content bounds
 * and downscaled from print resolution. Not modified otherwise, and no lockup
 * has been invented: each variant below is used as it was given.
 *
 * `public/brand/paydirect/` also holds the reversed lockup and both icon
 * variants, for the day a dark-ground surface needs them. They have no
 * component here because nothing calls one yet.
 *
 * **GNA — official.** Supplied artwork, cropped to its content bounds and
 * split into the full lockup and the mark alone at the gutter above the
 * letters. Downscaled, otherwise untouched. `gna-mark.png` has no component
 * here — both public pages carry the full lockup, and the mark is kept for the
 * mobile app's icons, which are generated from it. The SVG recreations that stood in
 * for these are deleted — an approximation left beside the real thing is one
 * someone eventually ships by mistake.
 */

// ─── GNA ───────────────────────────────────────────────────────────────────

export function GnaLogo({ className = 'h-20 w-auto' }: { className?: string }) {
  return (
    <img
      src="/brand/gna-digital-platform.png"
      alt="GNA Ghana News Agency — Digital Platform"
      className={className}
    />
  );
}

// ─── PayDirect ─────────────────────────────────────────────────────────────

/**
 * The payment provider's wordmark, navy, for light surfaces.
 *
 * This is the file supplied as the web logo, so it is what goes on a checkout
 * panel. Shown wherever money is taken — a person entering card details is
 * entitled to know who is processing them, and the answer being a named
 * provider rather than "us" is the reassuring part.
 */
export function PayDirectLogo({ className = 'h-6 w-auto' }: { className?: string }) {
  return <img src="/brand/paydirect/wordmark.png" alt="PayDirect" className={className} />;
}

/** "Payments secured by PayDirect", for the foot of a checkout panel. */
export function PoweredByPayDirect({ className = '' }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 text-2xs text-text-faint ${className}`}>
      Payments secured by
      <PayDirectLogo className="h-3 w-auto" />
    </span>
  );
}
