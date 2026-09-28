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
 * **GNA — official.** Supplied artwork, cropped to its content bounds.
 * Downscaled, otherwise untouched in colour. The SVG recreations that stood in
 * for these are deleted — an approximation left beside the real thing is one
 * someone eventually ships by mistake.
 *
 * `gna-symbol.png` is the supplied `gna_symbol.png` with the white lifted to
 * transparency: it arrived as RGB with no alpha, which is a white rectangle on
 * any surface that is not itself white. Alpha comes from each pixel's distance
 * to white, edge pixels are un-premultiplied so no curve carries a halo, and a
 * noise floor discards alpha below 12/255 — the file has been through lossy
 * compression and its "white" is a field of 252-254 that would otherwise show
 * as speckle on a dark ground. Ink colours are the artwork's own throughout.
 * `gna-symbol-reversed.png` additionally flips the gong-gong's near-neutral
 * black to white, for dark surfaces. The same two files are in the mobile app.
 *
 * `gna-digital-platform.png` is the full lockup and `gna-mark.png` the older
 * mark; neither is called any more, and both are kept because they are supplied
 * artwork rather than anything generated here.
 */

// ─── GNA ───────────────────────────────────────────────────────────────────

/**
 * The agency's symbol — the gong-gong, the drums and the flag arc.
 *
 * What the public pages lead with. They carried the full portrait lockup,
 * which spends most of its height on "GHANA NEWS AGENCY / DIGITAL PLATFORM" in
 * type small enough to read as a grey smear, above a heading that already says
 * Dawuro. The symbol is the part that is recognised at a glance, and it is the
 * same mark the phone shows at launch.
 */
export function GnaSymbol({
  className = 'h-20 w-auto',
  reversed = false,
}: {
  className?: string;
  /** The gong-gong in white, for a dark surface. */
  reversed?: boolean;
}) {
  return (
    <img
      src={reversed ? '/brand/gna-symbol-reversed.png' : '/brand/gna-symbol.png'}
      alt="Ghana News Agency"
      className={className}
    />
  );
}

/** The full lockup — mark, letters, and the two lines beneath. */
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
