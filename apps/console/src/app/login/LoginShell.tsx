import type { ReactNode } from 'react';
import { GnaLogo } from '@/components/Brand';

/**
 * The sign-in page frame.
 *
 * Two columns that scroll independently. The whole page scrolling as one was
 * the previous arrangement and it read badly: the brand statement drifted out
 * of view while the form stayed put, and on a short window the last line of
 * the left panel was clipped with nothing to indicate more existed.
 *
 * Each column now owns its own overflow, so the left panel is a fixed poster
 * and the right is the working surface. Below `lg` the poster is dropped
 * entirely rather than stacked — on a phone it is a screen of prose standing
 * between someone and the field they came to fill in.
 */
export function LoginShell({ children }: { children: ReactNode }) {
  return (
    <main className="lg:grid lg:h-screen lg:grid-cols-[1.05fr_1fr] lg:overflow-hidden">
      <BrandPanel />

      <section className="flex min-h-screen flex-col overflow-y-auto px-6 py-10 sm:px-10 lg:min-h-0 lg:py-12">
        <div className="mx-auto flex w-full max-w-[26rem] flex-1 flex-col justify-center">
          {/*
           * The lockup sits above the heading, on the side the eye is already
           * on — the left panel is decoration, this is the page.
           *
           * Sized so the two lines under the letters actually read. The
           * lockup is portrait, so height buys less width than it looks like
           * it should — at 72px "GHANA NEWS AGENCY" came out around four
           * pixels tall and read as a grey smear.
           */}
          {/* `self-start` matters: a flex child stretches to the column width by
              default, and the SVG then centres itself inside that box — which
              left the logo floating over the middle of a left-aligned page. */}
          <GnaLogo className="mb-8 h-[7.5rem] w-auto self-center" />
          {children}
        </div>
      </section>
    </main>
  );
}

function BrandPanel() {
  return (
    <section className="relative hidden flex-col justify-center gap-16 overflow-hidden bg-gradient-to-br from-accent via-accent to-accent-alt p-12 lg:flex">
      <div
        aria-hidden
        className="pointer-events-none absolute -right-28 -top-28 h-[26rem] w-[26rem] rounded-pill bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-36 -left-20 h-80 w-80 rounded-pill bg-black/10 blur-3xl"
      />

      <div className="relative">
        <p className="text-2xs font-semibold uppercase tracking-[0.2em] text-white/70">
          Dawuro Platform
        </p>
        <h1 className="mt-5 max-w-lg text-[2.6rem] font-semibold leading-[1.08] tracking-tight text-white">
          A fool-proof eye-witness account.
        </h1>

        {/*
         * Three claims, one line each.
         *
         * The previous version ran to four paragraphs and overflowed the
         * panel. A headline this strong needs backing on the same screen or it
         * is only a slogan — but the backing has to be readable at a glance,
         * not read.
         */}
        <ul className="mt-9 max-w-md space-y-5">
          <Claim n="01" title="Filmed where it says it was">
            The camera does not open until an accurate GPS fix is held.
          </Claim>
          <Claim n="02" title="The claim travels with the file">
            Time and place are stamped onto the footage, not written beside it.
          </Claim>
          <Claim n="03" title="It reaches someone who can act">
            Reports are matched to the organisations whose work they touch.
          </Claim>
        </ul>
      </div>

      <p className="absolute bottom-12 left-12 right-12 max-w-sm text-2xs leading-relaxed text-white/55">
        Reporting itself happens in the mobile app, where the camera and GPS live. This console is
        where the work that follows happens.
      </p>
    </section>
  );
}

/**
 * Numbered because these are sequential — capture, then provenance, then
 * routing. Numbering a set that has no order is decoration; this one has one.
 */
function Claim({ n, title, children }: { n: string; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="tabular pt-0.5 text-xs font-semibold text-white/45">{n}</span>
      <span>
        <span className="block text-[0.95rem] font-medium text-white">{title}</span>
        <span className="mt-0.5 block text-sm leading-relaxed text-white/70">{children}</span>
      </span>
    </li>
  );
}
