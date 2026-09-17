import fs from 'fs';
import path from 'path';

/**
 * Editors choose the top stories.
 *
 * The phone's top-story rotation takes the first reports the service returns
 * for a desk. Until `PATCH /editorial/{id}` existed that was simply the most
 * recently published — a pothole published a minute after a fatal accident led
 * above it, and nobody could change that. Led reports now come first.
 */

const SRC = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(SRC, rel), 'utf8');

/** Comments stripped, so a rule cannot pass by matching the note about it. */
const code = (rel: string) =>
  read(rel)
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

const ROUTE = 'app/api/editorial/[incidentId]/route.ts';
const DESK = 'app/(editorial)/editorial';

describe('a lead is its own decision', () => {
  test('it is sent as PATCH /editorial/{id}, not as a verification', () => {
    /*
     * Prominence and verification are different judgements. Leading a report
     * published an hour ago must not write a new verification into a permanent
     * history.
     */
    const route = code(ROUTE);
    expect(route).toMatch(/action: z\.literal\('lead'\)/);
    expect(route).toMatch(/method: 'PATCH'/);
    expect(route).toMatch(/leadUntil: input\.lead \? \(input\.leadUntil \?\? null\) : null/);
  });

  test('publishing can lead in the same step', () => {
    const route = code(ROUTE);
    expect(route).toMatch(/lead: z\.boolean\(\)\.optional\(\)/);
    expect(route).toMatch(/input\.lead !== undefined/);
  });

  test('the desk still guards who may do it', () => {
    expect(code(ROUTE)).toMatch(
      /session\.accountType !== 'editor' && session\.accountType !== 'platform_owner'/,
    );
  });
});

describe('the case has a Top story panel', () => {
  test('it posts the lead action and takes the service answer', () => {
    const panel = code(`${DESK}/LeadPanel.tsx`);
    expect(panel).toMatch(/action: 'lead', lead, leadUntil/);
    expect(panel).toMatch(/lead: answer\.result\?\.lead \?\? lead/);
  });

  test('only a published report can lead', () => {
    expect(code(`${DESK}/LeadPanel.tsx`)).toMatch(/!published \?/);
  });

  test('a lead expires by default, rather than freezing the front page', () => {
    const panel = code(`${DESK}/LeadPanel.tsx`);
    expect(panel).toMatch(/useState<Expiry>\('24'\)/);
    expect(panel).toMatch(/label: 'Until cleared'/);
  });

  test('the workbench shows it on every case', () => {
    expect(code(`${DESK}/Workbench.tsx`)).toMatch(/<LeadPanel/);
  });
});

describe('a report that is already published can be led', () => {
  /*
   * Triage lists only reports still waiting for a decision, so once a report
   * was published no screen could put it on the top stories or take it off.
   */
  test('Decided rows that only name a report are filled in, not dropped', () => {
    /*
     * `/editorial/decided` answers `{incidentId, vettingState, destination}` with
     * no report inside. Read as reports, none had an `id`, and the page said
     * "Nothing decided yet." over five published reports.
     */
    const page = code(`${DESK}/decided/page.tsx`);
    // A few at a time: all of them at once is what locks the console out.
    expect(page).toMatch(/mapWithLimit\(rows, completeRow, \{ onSkipped: \(row\) => row \}\)/);
    expect(page).toMatch(/const id = row\.id \?\? row\.incidentId/);
    expect(page).toMatch(/editorial\.workspace<\{ incident\?: Incident \}>\(id\)/);
  });

  test('every published row on Decided carries the control', () => {
    const page = code(`${DESK}/decided/page.tsx`);
    expect(page).toMatch(/const onFeed = \(incident: Incident\) => incident\.vettingState === 'published'/);
    expect(page).toMatch(/onFeed\(incident\) \? \(\s*<div[^>]*>\s*<LeadToggle/);
  });

  test('it sends the same lead action as the case panel', () => {
    expect(code(`${DESK}/leadApi.ts`)).toMatch(/action: 'lead', lead, leadUntil/);
    expect(code(`${DESK}/LeadToggle.tsx`)).toMatch(/sendLead\(incidentId, lead, expiry\)/);
  });

  test('the expiry control is labelled', () => {
    expect(code(`${DESK}/LeadToggle.tsx`)).toMatch(/<label htmlFor=\{selectId\}/);
  });
});

describe('every current lead is in one place', () => {
  test('the Leading page reads GET /editorial/leading', () => {
    expect(code(`${DESK}/leading/page.tsx`)).toMatch(/editorial\.leading<Incident>\(\)/);
    expect(code('lib/consoleApi.ts')).toMatch(/collect<T>\('\/editorial\/leading'\)/);
  });

  test('each lead can be cleared from there', () => {
    expect(code(`${DESK}/leading/LeadingList.tsx`)).toMatch(
      /action: 'lead', lead: false, leadUntil: null/,
    );
  });

  test('it is in the desk navigation', () => {
    expect(code('app/(editorial)/layout.tsx')).toMatch(
      /href: '\/editorial\/leading', label: 'Leading'/,
    );
  });
});

test('the feed settings are saved to the service, not to a file', () => {
  const store = code('lib/topStories.ts');
  expect(store).toMatch(/'\/platform\/settings'/);
  expect(store).toMatch(/method: 'PUT'/);
  expect(store).not.toMatch(/writeFile|readFile/);
});
