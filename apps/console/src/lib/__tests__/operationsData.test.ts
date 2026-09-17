import { nextStatus, normaliseAssignments } from '../assignments';
import { normaliseMetrics } from '../metrics';
import { normaliseNotes } from '../notes';
import { normaliseResults, normaliseSurvey } from '../surveys';

// ─── platform metrics ─────────────────────────────────────────────────────

test('metrics are read from the documented shape', () => {
  const metrics = normaliseMetrics({
    generatedAt: '2026-09-15T12:00:00.000Z',
    submissions: {
      total: 120,
      published: 80,
      pendingReview: 7,
      today: 4,
      last14Days: [
        { date: '2026-09-15', count: 4 },
        { date: '2026-09-14', count: 9 },
        { date: 'bad', count: -1 },
      ],
    },
    organisations: { total: 12, active: 9 },
    revenue: {
      revenueThisMonthPesewas: 1_250_000,
      subscriptionMrrPesewas: 900_000,
      downloadChargesPesewasThisPeriod: 350_000,
      payoutsReleasedThisMonthPesewas: 120_000,
    },
    routing: { pendingIncidents: 3 },
  });
  expect(metrics).toMatchObject({
    submissionsToday: 4,
    pendingReview: 7,
    organisationsActive: 9,
    revenueThisMonthPesewas: 1_250_000,
    routingPending: 3,
  });
  // Oldest first, and a malformed day is dropped.
  expect(metrics.last14Days).toEqual([
    { date: '2026-09-14', count: 9 },
    { date: '2026-09-15', count: 4 },
  ]);
});

test('a figure the service did not send is absent, not zero', () => {
  const metrics = normaliseMetrics({ submissions: { today: 2.5 }, revenue: {} });
  expect(metrics.submissionsToday).toBeNull();
  expect(metrics.revenueThisMonthPesewas).toBeNull();
  expect(normaliseMetrics(null).last14Days).toEqual([]);
});

// ─── assignments ──────────────────────────────────────────────────────────

test('assignments are read with their names and statuses', () => {
  const rows = normaliseAssignments([
    { id: 'as_1', incidentId: 'inc_1', employeeName: 'Kofi', status: 'en_route', note: null, updatedAt: '2026-09-15T10:00:00Z' },
    { id: 'as_2', incidentId: 'inc_2', assigneeId: 'emp_2', status: 'pending' },
    { id: 'as_3', status: 'teleported' },
    { incidentId: 'no-id' },
  ]);
  expect(rows.map((r) => [r.id, r.status, r.assigneeName])).toEqual([
    ['as_1', 'en_route', 'Kofi'],
    ['as_2', 'assigned', 'emp_2'],
    ['as_3', null, 'Unassigned'],
  ]);
  expect(rows[2]!.statusRaw).toBe('teleported');
});

test('each dispatch offers only the next step, and nothing after closing', () => {
  expect(nextStatus('assigned')).toBe('accepted');
  expect(nextStatus('accepted')).toBe('en_route');
  expect(nextStatus('en_route')).toBe('on_scene');
  expect(nextStatus('on_scene')).toBe('closed');
  expect(nextStatus('closed')).toBeNull();
  // A status the console does not understand is not guessed at.
  expect(nextStatus(null)).toBeNull();
});

// ─── notes ────────────────────────────────────────────────────────────────

test('notes are read oldest first, with a person named', () => {
  const notes = normaliseNotes({
    items: [
      { id: 'n2', body: 'Crew arrived.', author: { displayName: 'Ama' }, createdAt: '2026-09-15T11:00:00Z' },
      { id: 'n1', body: 'Called the district office.', author: { email: 'desk@amo.gov.gh' }, createdAt: '2026-09-15T09:00:00Z' },
      { id: 'n3', body: '   ', author: {}, createdAt: '2026-09-15T12:00:00Z' },
      { id: 'n4', body: 'No name.', author: 'usr_123', createdAt: '2026-09-15T13:00:00Z' },
    ],
  });
  expect(notes.map((n) => [n.id, n.authorName])).toEqual([
    ['n1', 'desk@amo.gov.gh'],
    ['n2', 'Ama'],
    ['n4', 'A colleague'],
  ]);
});

// ─── surveys ──────────────────────────────────────────────────────────────

const NOW = Date.parse('2026-09-15T12:00:00.000Z');

test('a survey summary does not crash the page and an open survey is live', () => {
  const survey = normaliseSurvey(
    { id: 'sv_1', title: 'Water supply', status: 'open', closesAtIso: '2026-09-20T00:00:00Z', responsesReceived: 12 },
    NOW,
  );
  expect(survey.questions).toEqual([]);
  expect(survey).toMatchObject({ status: 'live', accepting: true, hasCost: false, responsesReceived: 12 });
});

test('a closed or expired survey is not accepting', () => {
  expect(normaliseSurvey({ id: 'a', status: 'closed' }, NOW).accepting).toBe(false);
  expect(normaliseSurvey({ id: 'b', status: 'open', closesAtIso: '2026-09-01T00:00:00Z' }, NOW).accepting).toBe(false);
  expect(
    normaliseSurvey({ id: 'c', status: 'open', responsesTarget: 10, responsesReceived: 10 }, NOW).accepting,
  ).toBe(false);
});

test('results are read from either way of writing counts', () => {
  const results = normaliseResults({
    total: 30,
    aggregates: [
      { questionId: 'q1', prompt: 'Is there running water?', counts: { Yes: 8, No: 22 }, answered: 30 },
      { id: 'q2', question: 'Which days?', options: [{ label: 'Monday', count: 3 }, { value: 'Friday', count: 9 }] },
      { questionId: 'q3', label: 'How reliable, 1 to 5?', average: 2.4, responses: 28 },
    ],
  });
  expect(results.total).toBe(30);
  expect(results.questions[0]).toMatchObject({ label: 'Is there running water?', answered: 30 });
  // Most-chosen first.
  expect(results.questions[0]!.options).toEqual([
    { label: 'No', count: 22 },
    { label: 'Yes', count: 8 },
  ]);
  expect(results.questions[1]!.options.map((o) => o.label)).toEqual(['Friday', 'Monday']);
  expect(results.questions[2]).toMatchObject({ average: 2.4, answered: 28, options: [] });
});
