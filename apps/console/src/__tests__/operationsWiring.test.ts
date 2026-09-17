import fs from 'fs';
import path from 'path';

/**
 * The last of round four, connected: dashboard figures, dispatch assignments,
 * internal notes read back, and survey results.
 */

const SRC = path.resolve(__dirname, '..');

/** Comments stripped, so a rule cannot pass by matching the note explaining it. */
const code = (rel: string) =>
  fs
    .readFileSync(path.join(SRC, rel), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

test('the dashboard reads /platform/metrics and invents nothing', () => {
  expect(code('lib/consoleApi.ts')).toMatch(/get<T>\('\/platform\/metrics'\)/);
  const page = code('app/(platform)/platform/page.tsx');
  expect(page).toMatch(/\.then\(normaliseMetrics\)\s*\.catch\(\(\) => null\)/);
  expect(page).toMatch(/<Figures metrics=\{result\.data\.metrics\} \/>/);
  expect(page).not.toMatch(/PLATFORM_METRICS|Not available yet/);
});

test('assignments are listed and moved along through the service', () => {
  const api = code('lib/consoleApi.ts');
  expect(api).toMatch(/collect<T>\('\/org\/assignments'\)/);
  expect(api).toMatch(/`\/org\/assignments\/\$\{encodeURIComponent\(id\)\}`, 'PATCH'/);
  expect(code('app/api/org/assignments/[assignmentId]/route.ts')).toMatch(
    /z\.enum\(\['accepted', 'en_route', 'on_scene', 'closed'\]\)/,
  );
  const board = code('app/(organisation)/assignments/AssignmentsBoard.tsx');
  expect(board).toMatch(/fetch\(`\/api\/org\/assignments\/\$\{encodeURIComponent\(assignment\.id\)\}`/);
  // The row changes only after the service answered.
  const advance = board.slice(board.indexOf('const advance = async'), board.indexOf('return (\n    <Table'));
  expect(advance.indexOf('if (!res.ok)')).toBeLessThan(advance.indexOf('setRows('));
});

test('notes are read back in the report panel', () => {
  expect(code('lib/consoleApi.ts')).toMatch(
    /get<T>\(`\/org\/incidents\/\$\{encodeURIComponent\(incidentId\)\}\/notes`\)/,
  );
  const route = code('app/api/org/incidents/[incidentId]/notes/route.ts');
  expect(route).toMatch(/export async function GET/);
  expect(route).toMatch(/export async function POST/);
  expect(code('app/(organisation)/inbox/InboxWorkspace.tsx')).toMatch(
    /<NotesPanel incidentId=\{incident\.id\} \/>/,
  );
  // After adding, the list is read again rather than appended to locally.
  const panel = code('components/NotesPanel.tsx');
  expect(panel.slice(panel.indexOf('const add = async'))).toMatch(/await refresh\(\)/);
});

test('survey results and closing go to the service', () => {
  const api = code('lib/consoleApi.ts');
  expect(api).toMatch(/`\/org\/surveys\/\$\{encodeURIComponent\(id\)\}\/responses`/);
  expect(api).toMatch(/`\/org\/surveys\/\$\{encodeURIComponent\(id\)\}`, 'PATCH'/);
  expect(code('app/api/org/surveys/[surveyId]/route.ts')).toMatch(
    /org\.updateSurvey\(surveyId, \{ status: 'closed' \}\)/,
  );

  const page = code('app/(organisation)/surveys/page.tsx');
  expect(page).toMatch(/normaliseSurvey\(survey\)/);
  expect(page).toMatch(/<SurveyActions surveyId=\{survey\.id\}/);
  // A cost is only shown when the survey carries one.
  expect(page).toMatch(/survey\.hasCost\s*\?/);
});

test('the submit-report page shows no typed-in figures', () => {
  const page = code('app/(organisation)/agent/page.tsx');
  expect(page).not.toMatch(/value="4"|value="2"|Accra Metropolitan Assembly" \/>/);
});
