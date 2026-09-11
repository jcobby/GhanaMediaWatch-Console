import fs from 'fs';
import path from 'path';
import {
  ASSURANCE_META,
  RESPONSE_META,
  SEVERITY_META,
  VERIFICATION_META,
  assuranceMeta,
  responseMeta,
  severityMeta,
  verificationMeta,
} from '@dawuro/core';

/**
 * A value off the wire must never index a `Record` directly.
 *
 * `VERIFICATION_META` is typed `Record<VerificationState, VerificationMeta>`,
 * which is a promise TypeScript can keep only about values TypeScript produced.
 * Every value these screens index it with is JSON from a service that publishes
 * no response schema for half its endpoints — so the compiler is satisfied and
 * the browser is not.
 *
 * `/editorial/decided` is what proved it. The page mapped rows to an incident
 * shape that was a guess, the guess was wrong, and
 * `VERIFICATION_META[undefined].permittedRepresentation` took the entire route
 * down. Not the row: the route. A verification desk showing nothing at all
 * because one row was shaped differently is a far worse failure than a row that
 * reads "unrecognised".
 *
 * So each map has an accessor, and anything keyed on server data goes through
 * it. Lookups keyed on a value the client produced — iterating a constant list,
 * a state from `nextStates`, a locally computed tier — still index directly,
 * and should: a fallback there would hide a real bug rather than prevent one.
 */

const APP = path.resolve(__dirname, '..');

function sources(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.tsx?$/.test(entry.name)) out.push(full);
    }
  };
  walk(root);
  return out;
}

describe('the accessors answer for anything', () => {
  test('an unrecognised value returns meta rather than undefined', () => {
    for (const [name, fn] of [
      ['verification', verificationMeta],
      ['assurance', assuranceMeta],
      ['severity', severityMeta],
      ['response', responseMeta],
    ] as const) {
      for (const input of [undefined, null, '', 'something_the_server_added_later']) {
        const meta = fn(input as string);
        expect([name, input, typeof meta?.label]).toEqual([name, input, 'string']);
      }
    }
  });

  test('a known value still returns exactly what the record holds', () => {
    // The accessor is a guard, not a translation layer.
    expect(verificationMeta('verified_high_confidence')).toBe(
      VERIFICATION_META.verified_high_confidence,
    );
    expect(assuranceMeta('A')).toBe(ASSURANCE_META.A);
    expect(severityMeta('urgent')).toBe(SEVERITY_META.urgent);
    expect(responseMeta('resolved')).toBe(RESPONSE_META.resolved);
  });

  test('the fallback never clears a gate', () => {
    /*
     * The important half. A state this console does not understand must not be
     * treated as one that permits publication, licensing, or the word
     * "verified" — the safe direction is the restrictive one, every time.
     */
    const unknown = verificationMeta('something_new');
    expect(unknown.publishable).toBe(false);
    expect(unknown.licensable).toBe(false);
    expect(unknown.mayUseWordVerified).toBe(false);

    // And an unrecognised capture class cannot stand on its own.
    expect(assuranceMeta('Z').usableAlone).toBe(false);

    // An unrecognised action does not close a case or notify a reporter about
    // something nobody here can name.
    expect(responseMeta('escalated_somehow').terminal).toBe(false);
    expect(responseMeta('escalated_somehow').notifiesReporter).toBe(false);
  });

  test('an unrecognised severity cannot climb a triage queue', () => {
    // Weight feeds the ordering. A word nobody understands must not outrank a
    // real emergency because the fallback happened to be generous.
    expect(severityMeta('catastrophic').weight).toBeLessThanOrEqual(
      SEVERITY_META.observation.weight,
    );
  });
});

describe('no screen indexes a map with server data', () => {
  test('the four maps are never indexed by a report field', () => {
    /*
     * The precise shape of the bug, as a rule: `META[something.field]` where
     * the field arrives as JSON. Keyed on a constant or a local, it is fine and
     * is left alone.
     */
    const offenders: string[] = [];
    const dangerous = [
      /VERIFICATION_META\[\w+\.verification\]/,
      /ASSURANCE_META\[\w+\.assurance\]/,
      /SEVERITY_META\[\w+\.severity\]/,
      /RESPONSE_META\[\w+!?\.action\]/,
    ];

    for (const file of sources(APP)) {
      if (file.includes('__tests__')) continue;
      const code = fs
        .readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

      for (const pattern of dangerous) {
        if (pattern.test(code)) offenders.push(`${path.relative(APP, file)} — ${pattern.source}`);
      }
    }

    expect(offenders).toEqual([]);
  });
});

describe('the page that found it', () => {
  /* Comments stripped: the note explaining the crash quotes the very
     expression the last rule forbids. */
  const decided = fs
    .readFileSync(path.join(APP, 'app', '(editorial)', 'editorial', 'decided', 'page.tsx'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ');

  test('it reads every shape the undocumented endpoint might use', () => {
    /*
     * `d.incident ?? d` was a bet on one of three readings, and for a row with
     * neither the fallback was the row itself — no `verification`, and the
     * crash. `/editorial/queue` had already taught this lesson: its items *are*
     * the reports, which the console spent a day not knowing.
     */
    expect(decided).toMatch(/row\.incident \?\? row\.report \?\? \(row as unknown as Incident\)/);
  });

  test('a row with nothing in it is dropped, not rendered as blanks', () => {
    expect(decided).toMatch(
      /filter\(\(incident\): incident is Incident => Boolean\(incident\?\.id\)\)/,
    );
  });

  test('the lookup that crashed goes through the accessor', () => {
    expect(decided).toMatch(/verificationMeta\(incident\.verification\)/);
    expect(decided).not.toMatch(/VERIFICATION_META\[/);
  });
});
