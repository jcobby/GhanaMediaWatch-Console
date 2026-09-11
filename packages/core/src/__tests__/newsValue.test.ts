import {
  GATES_UNANSWERED,
  criterionContributions,
  leadingReasons,
  MIN_PLAUSIBLE_MEDIA_BYTES,
  GHANA_REGIONS,
  MAX_RAW_TOTAL,
  NEUTRAL_RATINGS,
  NEWS_CRITERIA,
  NEWS_GATES,
  NEWS_MODIFIERS,
  NEWS_TIERS,
  NEWS_TIER_META,
  NO_MODIFIERS,
  SCORE_SCALE,
  applyElectionFairness,
  breakTie,
  demoteTier,
  deriveGates,
  failedGates,
  needsSecondEditor,
  passesAllGates,
  provisionalAssessment,
  regionFromCoordinates,
  scoreNews,
  tierFor,
  type NewsRatings,
  type ProvisionalInput,
  type Rating,
} from '../logic/newsValue';
import { EMPTY_CORROBORATION } from '../logic/editorial';

const ratingsOf = (value: Rating): NewsRatings =>
  Object.fromEntries(NEWS_CRITERIA.map((c) => [c.id, value])) as NewsRatings;

// ─── the scale ─────────────────────────────────────────────────────────────

test('the weights are the ten from the criteria and sum to 110', () => {
  // Pins the specification. A weight edited by hand somewhere else changes
  // every threshold silently, because the thresholds are percentages of this.
  expect(NEWS_CRITERIA).toHaveLength(10);
  expect(NEWS_CRITERIA.reduce((sum, c) => sum + c.weight, 0)).toBe(110);
  expect(MAX_RAW_TOTAL).toBe(550);
});

test('a perfect story scores the top of the scale, not 550', () => {
  /*
   * The arithmetic the criteria was written with does not close: ten weights
   * summing to 110, rated out of 5, give 550 — while the thresholds are stated
   * out of 500 and are exactly 75%, 60% and 45% of it. The percentages are the
   * intent, so the score is expressed on the scale its own thresholds live on.
   */
  const perfect = scoreNews(ratingsOf(5));
  expect(perfect.rawTotal).toBe(550);
  expect(perfect.score).toBe(SCORE_SCALE);
  expect(perfect.tier).toBe('lead');

  /*
   * And a mid-scale story, because the top of the range cannot show this on its
   * own: an un-normalised 550 is clamped back to 500 by the scale guard and
   * reads correct by accident. Four across the board is 440 raw, which is 400
   * once expressed on the 500-point scale and 440 if the normalisation is
   * skipped — the first score where the two arithmetics visibly disagree.
   */
  const strong = scoreNews(ratingsOf(4));
  expect(strong.rawTotal).toBe(440);
  expect(strong.score).toBe(400);
});

test('the thresholds are the three the criteria states', () => {
  expect(NEWS_TIER_META.lead.floor).toBe(375);
  expect(NEWS_TIER_META.top_five.floor).toBe(300);
  expect(NEWS_TIER_META.inside.floor).toBe(225);
});

test('each tier begins exactly at its floor', () => {
  // Inclusive bounds. 375 is a lead, 374 is not.
  for (const tier of NEWS_TIERS) {
    expect([tier.id, tierFor(tier.floor)]).toEqual([tier.id, tier.id]);
    if (tier.floor > 0) {
      expect(tierFor(tier.floor - 1)).not.toBe(tier.id);
    }
  }
});

test('a wholly average story sits exactly on the top-five floor', () => {
  // Every criterion at the midpoint is 60%, which is that floor to the point.
  const average = scoreNews(NEUTRAL_RATINGS);
  expect(average.score).toBe(300);
  expect(average.tier).toBe('top_five');
});

test('the weakest possible story is a brief', () => {
  expect(scoreNews(ratingsOf(1)).tier).toBe('brief');
});

// ─── modifiers ─────────────────────────────────────────────────────────────

test('modifiers move the score by exactly the stated points', () => {
  const base = scoreNews(NEUTRAL_RATINGS);
  const boosted = scoreNews(NEUTRAL_RATINGS, { ...NO_MODIFIERS, regional_balance: true });

  expect(boosted.score - base.score).toBe(25);
  expect(boosted.baseScore).toBe(base.score);
  expect(boosted.applied).toEqual([{ id: 'regional_balance', points: 25 }]);
});

test('the modifiers are the four from the criteria, with their signs', () => {
  const points = Object.fromEntries(NEWS_MODIFIERS.map((m) => [m.id, m.points]));
  expect(points).toEqual({
    regional_balance: 25,
    local_language: 15,
    ritual_discount: -20,
    rumour_decay: -30,
  });
});

test('modifiers cannot push a score off either end of the scale', () => {
  /*
   * Both bonuses on a perfect story would read 540 out of 500, and both
   * penalties on the weakest would read below zero. Either makes two scores
   * incomparable, which is the one thing a ranking number has to be.
   */
  const over = scoreNews(ratingsOf(5), {
    ...NO_MODIFIERS,
    regional_balance: true,
    local_language: true,
  });
  expect(over.score).toBe(SCORE_SCALE);

  /*
   * The floor is never actually reached, and that is worth pinning rather than
   * asserting a 0 the arithmetic cannot produce. The weakest story scores 100,
   * both penalties take 50, so nothing lands below 50 — the clamp is defence
   * against a future modifier, not something in play today.
   */
  const under = scoreNews(ratingsOf(1), {
    ...NO_MODIFIERS,
    ritual_discount: true,
    rumour_decay: true,
  });
  expect(under.score).toBe(50);
  expect(under.score).toBeGreaterThanOrEqual(0);
});

// ─── gates ─────────────────────────────────────────────────────────────────

test('nothing passes until every gate has been answered', () => {
  expect(passesAllGates(GATES_UNANSWERED)).toBe(false);

  const allButOne = {
    ...GATES_UNANSWERED,
    verification: 'pass',
    legal: 'pass',
    harm: 'pass',
  } as const;
  expect(passesAllGates(allButOne)).toBe(false);

  expect(
    passesAllGates({
      verification: 'pass',
      legal: 'pass',
      harm: 'pass',
      public_interest: 'pass',
    }),
  ).toBe(true);
});

test('an unanswered gate is not a failed gate', () => {
  /*
   * The distinction the whole type exists for. "Nobody has checked the legal
   * position" and "the legal position is bad" call for opposite actions, and a
   * boolean would report them identically.
   */
  expect(failedGates(GATES_UNANSWERED)).toEqual([]);
  expect(failedGates({ ...GATES_UNANSWERED, legal: 'fail' })).toEqual(['legal']);
});

test('two independent checks pass the verification gate', () => {
  const gates = deriveGates({
    corroboration: { completed: ['independent_witness', 'field_followup'], notes: null },
    handling: [],
    redactionApplied: false,
  });
  expect(gates.verification).toBe('pass');
});

test('one primary document passes it alone', () => {
  // The criteria's own "or": two independent sources, *or* one primary
  // document. `official_record` is the primary document in Dawuro's vocabulary.
  const gates = deriveGates({
    corroboration: { completed: ['official_record'], notes: null },
    handling: [],
    redactionApplied: false,
  });
  expect(gates.verification).toBe('pass');
});

test('the reporter corroborating their own footage passes nothing', () => {
  const gates = deriveGates({
    corroboration: { completed: ['source_contacted'], notes: null },
    handling: [],
    redactionApplied: false,
  });
  expect(gates.verification).toBe('unanswered');
});

test('footage needing redaction that has not had it fails the harm gate', () => {
  /*
   * A failure rather than an absence, and the only thing here treated that way:
   * the reporter said there are children in it and nobody has obscured them.
   * As `unanswered` it would sit in a queue looking merely incomplete.
   */
  const gates = deriveGates({
    corroboration: EMPTY_CORROBORATION,
    handling: ['redact_before_publication'],
    redactionApplied: false,
  });
  expect(gates.harm).toBe('fail');
  expect(failedGates(gates)).toEqual(['harm']);
});

test('once redaction is applied the harm gate stops failing', () => {
  const gates = deriveGates({
    corroboration: EMPTY_CORROBORATION,
    handling: ['redact_before_publication'],
    redactionApplied: true,
  });
  expect(gates.harm).toBe('unanswered');
});

test('the platform never answers the legal or public interest gates', () => {
  /*
   * It has no basis to. A model that guessed at contempt risk would be
   * inventing a legal opinion, and an editor who saw it pre-filled would stop
   * reading it.
   */
  const gates = deriveGates({
    corroboration: { completed: ['official_record', 'field_followup'], notes: null },
    handling: [],
    redactionApplied: true,
  });
  expect(gates.legal).toBe('unanswered');
  expect(gates.public_interest).toBe('unanswered');
});

test('every gate says why it cannot be waived', () => {
  // A gate an editor cannot see the reason for is one they will argue past.
  for (const gate of NEWS_GATES) {
    expect([gate.id, gate.because.length > 20]).toEqual([gate.id, true]);
  }
});

// ─── the election-period rule ──────────────────────────────────────────────

const CAMPAIGN = { inCampaignPeriod: true, partisanClaim: true, hasSameCycleResponse: false };

test('an unanswered partisan claim drops a tier during a campaign', () => {
  const lead = scoreNews(ratingsOf(5));
  expect(lead.tier).toBe('lead');
  expect(applyElectionFairness(lead, CAMPAIGN).tier).toBe('top_five');
});

test('a response in the same cycle keeps the tier', () => {
  const lead = scoreNews(ratingsOf(5));
  expect(applyElectionFairness(lead, { ...CAMPAIGN, hasSameCycleResponse: true }).tier).toBe(
    'lead',
  );
});

test('outside a campaign the rule does nothing', () => {
  const lead = scoreNews(ratingsOf(5));
  expect(applyElectionFairness(lead, { ...CAMPAIGN, inCampaignPeriod: false }).tier).toBe('lead');
});

test('the rule leaves the score alone and moves only the tier', () => {
  /*
   * It is a placement decision, not a claim that the story is worth less. An
   * adjusted score would carry the demotion into every later comparison,
   * including after the response arrives.
   */
  const lead = scoreNews(ratingsOf(5));
  const after = applyElectionFairness(lead, CAMPAIGN);
  expect(after.score).toBe(lead.score);
});

test('a story below the top-five floor is not demoted', () => {
  // Nothing is being elevated, so the fairness problem does not arise.
  const modest = scoreNews(ratingsOf(2));
  expect(modest.score).toBeLessThan(NEWS_TIER_META.top_five.floor);
  expect(applyElectionFairness(modest, CAMPAIGN).tier).toBe(modest.tier);
});

test('a brief cannot be demoted below a brief', () => {
  expect(demoteTier('brief')).toBe('brief');
});

// ─── the ownership rule ────────────────────────────────────────────────────

test('an ownership conflict calls for a second editor, not a lower score', () => {
  /*
   * Discounting instead would bury exactly the stories an outlet is least
   * willing to run about itself, which is the opposite of what the check is
   * for. The check is on the process.
   */
  expect(
    needsSecondEditor({
      involvesOwner: true,
      involvesAdvertiser: false,
      involvesAffiliatedParty: false,
    }),
  ).toBe(true);

  expect(
    needsSecondEditor({
      involvesOwner: false,
      involvesAdvertiser: false,
      involvesAffiliatedParty: false,
    }),
  ).toBe(false);
});

// ─── tie-breaks ────────────────────────────────────────────────────────────

const candidate = (ratings: NewsRatings, extra: Partial<Parameters<typeof breakTie>[0]> = {}) => ({
  score: scoreNews(ratings),
  ratings,
  hasNamedOnRecordSource: false,
  region: null,
  ...extra,
});

test('a comfortable win is never overturned by a tie-break', () => {
  // Outside the window the score already decided; overriding it there would
  // make the score decorative.
  const strong = candidate(ratingsOf(5));
  const weak = candidate(ratingsOf(2), { hasNamedOnRecordSource: true });
  const outcome = breakTie(strong, weak);

  expect(outcome.order).toBe(-1);
  expect(outcome.reason).toBeNull();
});

test('inside the window, the story that changes what a reader does wins', () => {
  const useful = { ...NEUTRAL_RATINGS, utility: 5 as Rating, novelty: 1 as Rating };
  const novel = { ...NEUTRAL_RATINGS, utility: 1 as Rating, novelty: 5 as Rating };

  const outcome = breakTie(candidate(useful), candidate(novel));
  expect(outcome).toEqual({ order: -1, reason: 'changes_what_a_reader_does' });
});

test('then exclusivity, then a named source, then geography', () => {
  const level = NEUTRAL_RATINGS;

  /*
   * One rating point apart, not three. Timeliness is weighted 12, so a gap of
   * three moves the score by 33 and the two stories are no longer close enough
   * to need a tie-break at all — the window would decide it before this rule
   * ever ran.
   */
  const exclusive = breakTie(
    candidate({ ...level, timeliness: 4 as Rating }),
    candidate({ ...level, timeliness: 3 as Rating }),
  );
  expect(exclusive).toEqual({ order: -1, reason: 'exclusive' });

  const named = breakTie(
    candidate(level, { hasNamedOnRecordSource: true }),
    candidate(level, { hasNamedOnRecordSource: false }),
  );
  expect(named).toEqual({ order: -1, reason: 'named_on_record_source' });

  const regional = breakTie(
    candidate(level, { region: 'upper_west' }),
    candidate(level, { region: 'greater_accra' }),
  );
  expect(regional).toEqual({ order: -1, reason: 'outside_greater_accra' });
});

test('two identical stories are left tied rather than separated arbitrarily', () => {
  expect(breakTie(candidate(NEUTRAL_RATINGS), candidate(NEUTRAL_RATINGS))).toEqual({
    order: 0,
    reason: null,
  });
});

// ─── Ghana's regions ───────────────────────────────────────────────────────

test('all sixteen regions are present, with the seven under-reported ones marked', () => {
  expect(GHANA_REGIONS).toHaveLength(16);

  const underReported = GHANA_REGIONS.filter((r) => r.underReported)
    .map((r) => r.id)
    .sort();
  expect(underReported).toEqual([
    'bono_east',
    'north_east',
    'oti',
    'savannah',
    'upper_east',
    'upper_west',
    'western_north',
  ]);
});

test('coordinates in Accra and in Wa resolve to their own regions', () => {
  expect(regionFromCoordinates({ latitude: 5.56, longitude: -0.2 })?.id).toBe('greater_accra');
  expect(regionFromCoordinates({ latitude: 10.06, longitude: -2.5 })?.id).toBe('upper_west');
  expect(regionFromCoordinates({ latitude: 6.69, longitude: -1.62 })?.id).toBe('ashanti');
});

test('a report with no fix has no region', () => {
  expect(regionFromCoordinates({ latitude: null, longitude: null })).toBeNull();
});

test('a coordinate far outside Ghana is refused rather than snapped to a border region', () => {
  /*
   * Nearest-capital always has an answer, including for Lagos and for a fix of
   * (0, 0) in the Gulf of Guinea. Handing out the under-reported bonus for
   * being off the map is worse than admitting the guess does not apply.
   */
  expect(regionFromCoordinates({ latitude: 6.52, longitude: 3.37 })).toBeNull();
  expect(regionFromCoordinates({ latitude: 0, longitude: 0 })).toBeNull();
});

// ─── the provisional score ─────────────────────────────────────────────────

const INTAKE: ProvisionalInput = {
  category: 'other',
  severity: 'concern',
  mediaKind: 'photo',
  assurance: 'C',
  destination: 'public',
  capturedAtIso: '2026-09-09T09:00:00.000Z',
  nowIso: '2026-09-09T10:00:00.000Z',
  location: { latitude: 5.56, longitude: -0.2 },
  corroboration: EMPTY_CORROBORATION,
};

test('every report gets a score on arrival', () => {
  const assessment = provisionalAssessment(INTAKE);
  expect(assessment.score.score).toBeGreaterThan(0);
  expect(NEWS_TIERS.map((t) => t.id)).toContain(assessment.score.tier);
});

test('the provisional score reports what it could not assess', () => {
  /*
   * The honest half. Five criteria need a person — who is involved, whether
   * this is a first, whether an audience is already following it, and which
   * audience the outlet serves. A screen showing the number without showing
   * this is presenting a placeholder as a judgement.
   */
  const assessment = provisionalAssessment(INTAKE);
  expect(assessment.unassessed.sort()).toEqual([
    'continuity',
    'human_interest',
    'novelty',
    'prominence',
    'proximity',
  ]);
  expect(assessment.score.unassessed).toEqual(assessment.unassessed);
});

test('unassessed criteria sit at the neutral midpoint, not at zero', () => {
  // A 1 across five unrated criteria would bury every report nobody has looked
  // at yet, which is the opposite of the point of an intake queue.
  const { ratings } = provisionalAssessment(INTAKE);
  expect(ratings.prominence).toBe(3);
  expect(ratings.novelty).toBe(3);
});

test('severity feeds impact but can never reach the top of it', () => {
  /*
   * Severity is the reporter's claim about urgency, not a measure of how many
   * people are affected. A 5 for impact means nationwide, and nobody standing
   * in front of one incident is in a position to tell us that.
   */
  const emergency = provisionalAssessment({ ...INTAKE, severity: 'emergency' });
  const observation = provisionalAssessment({ ...INTAKE, severity: 'observation' });

  expect(emergency.ratings.impact).toBe(4);
  expect(observation.ratings.impact).toBe(1);
  expect(emergency.ratings.impact).toBeLessThan(5);
});

test('timeliness decays with age', () => {
  const fresh = provisionalAssessment({ ...INTAKE, capturedAtIso: '2026-09-09T09:30:00.000Z' });
  const yesterday = provisionalAssessment({ ...INTAKE, capturedAtIso: '2026-09-08T09:00:00.000Z' });
  const lastWeek = provisionalAssessment({ ...INTAKE, capturedAtIso: '2026-09-01T09:00:00.000Z' });

  expect(fresh.ratings.timeliness).toBeGreaterThan(yesterday.ratings.timeliness);
  expect(yesterday.ratings.timeliness).toBeGreaterThan(lastWeek.ratings.timeliness);
});

test('only something still ours reaches the top of timeliness', () => {
  /*
   * The criterion is timeliness *and* exclusivity, and a 5 means "broken first,
   * with documents". Age alone stops at 4 — otherwise anything filmed in the
   * last six hours maxed out and the exclusivity half of the criterion never
   * showed up at all, which is most of an intake queue.
   */
  const exclusive = provisionalAssessment({ ...INTAKE, destination: 'directed' });
  const published = provisionalAssessment({ ...INTAKE, destination: 'public' });

  expect(exclusive.ratings.timeliness).toBe(5);
  expect(published.ratings.timeliness).toBe(4);
});

test('a road closure rates higher on utility than an unclassified report', () => {
  expect(provisionalAssessment({ ...INTAKE, category: 'road' }).ratings.utility).toBeGreaterThan(
    provisionalAssessment({ ...INTAKE, category: 'other' }).ratings.utility,
  );
});

test('galamsey and corruption rate highest on accountability', () => {
  const galamsey = provisionalAssessment({ ...INTAKE, category: 'galamsey' });
  const chieftaincy = provisionalAssessment({ ...INTAKE, category: 'chieftaincy' });
  const other = provisionalAssessment({ ...INTAKE, category: 'other' });

  expect(galamsey.ratings.accountability).toBe(4);
  expect(chieftaincy.ratings.accountability).toBe(3);
  expect(other.ratings.accountability).toBe(2);
});

test('app-captured video is stronger material than an imported still', () => {
  const trusted = provisionalAssessment({ ...INTAKE, mediaKind: 'video', assurance: 'A' });
  const imported = provisionalAssessment({ ...INTAKE, mediaKind: 'photo', assurance: 'C' });
  expect(trusted.ratings.visual_strength).toBeGreaterThan(imported.ratings.visual_strength);
});

test('a report from an under-reported region carries the bonus automatically', () => {
  const wa = provisionalAssessment({ ...INTAKE, location: { latitude: 10.06, longitude: -2.5 } });
  expect(wa.region?.id).toBe('upper_west');
  expect(wa.modifiers.regional_balance).toBe(true);

  const accra = provisionalAssessment(INTAKE);
  expect(accra.modifiers.regional_balance).toBe(false);
});

test('nothing independent yet means the rumour penalty applies, and it lifts', () => {
  /*
   * "Not yet" rather than a verdict — it falls away the moment one independent
   * check is recorded, which is what makes it a prompt rather than a judgement.
   */
  const bare = provisionalAssessment(INTAKE);
  expect(bare.modifiers.rumour_decay).toBe(true);

  const checked = provisionalAssessment({
    ...INTAKE,
    corroboration: { completed: ['official_record'], notes: null },
  });
  expect(checked.modifiers.rumour_decay).toBe(false);
  expect(checked.score.score).toBeGreaterThan(bare.score.score);
});

test('age is measured against the nowIso passed in, not against today', () => {
  /*
   * The test that catches a model reading its own clock. Decay and repeatability
   * both pass with `Date.now()` — the fixtures are dated near today and two
   * calls a millisecond apart land in the same bucket. A `nowIso` a year on has
   * to make the same footage stale, and nothing but the argument can do that.
   */
  const asFiled = provisionalAssessment(INTAKE);
  const aYearLater = provisionalAssessment({ ...INTAKE, nowIso: '2027-09-09T10:00:00.000Z' });

  expect(asFiled.ratings.timeliness).toBe(4);
  expect(aYearLater.ratings.timeliness).toBe(1);
});

test('a capture that stands on its own is not treated as a rumour', () => {
  /*
   * Rumour decay is about provenance, not about how much checking has happened
   * yet. Read as "nothing independent recorded", it fired on every report on
   * the routing desk — corroboration is editorial work and has not started
   * there — so a -30 that could never vary came off every score on the queue.
   * Measured against the live service: nine of nine reports penalised
   * identically, which ranks nothing.
   *
   * And it was wrong about them. Those nine are Class A — captured in the app,
   * signature valid, time and location checks passed. That footage *is* a
   * primary source of what it shows. The report the criterion describes is
   * Class C, "imported from a gallery, messaging app, web form or third party",
   * which the assurance model already marks as usable only as a lead.
   */
  const trusted = provisionalAssessment({ ...INTAKE, assurance: 'A' });
  const institutional = provisionalAssessment({ ...INTAKE, assurance: 'D' });
  const imported = provisionalAssessment({ ...INTAKE, assurance: 'C' });

  expect(trusted.modifiers.rumour_decay).toBe(false);
  expect(institutional.modifiers.rumour_decay).toBe(false);
  expect(imported.modifiers.rumour_decay).toBe(true);
});

test('an imported capture stops being a rumour once something independent lands', () => {
  // Still a prompt rather than a verdict: it lifts on the first check.
  const checked = provisionalAssessment({
    ...INTAKE,
    assurance: 'C',
    corroboration: { completed: ['official_record'], notes: null },
  });
  expect(checked.modifiers.rumour_decay).toBe(false);
});

test('the same inputs always give the same score', () => {
  /*
   * Nothing here reads a clock of its own — `nowIso` is passed in. A model that
   * consulted `Date.now()` would rank a queue differently on every render and
   * could not be pinned by a test.
   */
  expect(provisionalAssessment(INTAKE)).toEqual(provisionalAssessment(INTAKE));
});

// ─── showing the working ───────────────────────────────────────────────────

test('the breakdown accounts for the whole score', () => {
  /*
   * A ranked queue that shows only a total ranks reports by a number nobody can
   * argue with, which is the opposite of what writing the criteria down was
   * for. The parts have to add up to the whole, or the explanation is a
   * decoration sitting next to the real answer.
   *
   * Per-criterion rounding means the parts can differ from the total by a point
   * or two. Showing exact fractions instead would be tidier and useless —
   * nobody reads 54.5454 as a reason.
   */
  const score = scoreNews(NEUTRAL_RATINGS);
  const parts = criterionContributions(NEUTRAL_RATINGS);
  const summed = parts.reduce((total, p) => total + p.points, 0);

  expect(parts).toHaveLength(NEWS_CRITERIA.length);
  expect(Math.abs(summed - score.baseScore)).toBeLessThanOrEqual(NEWS_CRITERIA.length);
});

test('the breakdown leads with what actually decided it', () => {
  // Ordered by contribution, so the reason a report ranks where it does reads
  // off the top rather than being reconstructed from ten rows.
  const ratings = { ...NEUTRAL_RATINGS, visual_strength: 5 as Rating, impact: 1 as Rating };
  const parts = criterionContributions(ratings);

  for (let i = 1; i < parts.length; i += 1) {
    expect(parts[i - 1]!.points).toBeGreaterThanOrEqual(parts[i]!.points);
  }
});

test('a criterion nobody rated is marked, not hidden', () => {
  // A 3 that was never chosen looks exactly like a 3 that was, and only one of
  // them is a judgement.
  const parts = criterionContributions(NEUTRAL_RATINGS, ['prominence']);
  expect(parts.find((p) => p.id === 'prominence')?.unassessed).toBe(true);
  expect(parts.find((p) => p.id === 'impact')?.unassessed).toBe(false);
});

test('a reason has to be a strength, not just the biggest number', () => {
  /*
   * Ranking the contributions by points alone put "Impact 2/5" at the head of
   * most rows on the live queue — arithmetically true, because a criterion
   * weighted 20 outscores one weighted 5 even when rated badly, and
   * communicatively nonsense. An operator reading "why is this here? impact 2
   * out of 5" learns nothing and reads a weakness as a justification.
   */
  const weak = leadingReasons({ ...NEUTRAL_RATINGS, impact: 2 as Rating });
  expect(weak).toHaveLength(0);

  const strong = leadingReasons({ ...NEUTRAL_RATINGS, utility: 5 as Rating });
  expect(strong.map((r) => r.id)).toEqual(['utility']);
});

test('a reason is never drawn from a default nobody chose', () => {
  // Saying "ranked on continuity" about an unrated midpoint invents a reason,
  // which is worse than giving none.
  const ratings = { ...NEUTRAL_RATINGS, continuity: 5 as Rating };
  expect(leadingReasons(ratings, ['continuity'])).toHaveLength(0);
  expect(leadingReasons(ratings, [])).toHaveLength(1);
});

test('every criterion has a short label that fits a queue row', () => {
  /*
   * "National impact and magnitude 4/5" is right on a panel and truncates to
   * "National imp…" in a 340px column, which names nothing. The short form is a
   * separate field so the abbreviation is chosen rather than cut.
   */
  for (const criterion of NEWS_CRITERIA) {
    expect([criterion.id, criterion.short.length > 0]).toEqual([criterion.id, true]);
    expect([criterion.id, criterion.short.length <= 14]).toEqual([criterion.id, true]);
  }
});

test('footage that is not there is not strong footage', () => {
  /*
   * The kind and the assurance class describe what a capture *claims* to be,
   * and both can be right about a file with nothing in it. Measured on the live
   * queue: a 4 KB upload recorded as `kind: video, assurance: A` scored 5 out
   * of 5 for visual strength while the frame beside it said the file was
   * unplayable. The queue was ranking a report on pictures nobody could watch.
   */
  const real = provisionalAssessment({
    ...INTAKE,
    mediaKind: 'video',
    assurance: 'A',
    mediaByteSize: 3_600_000,
  });
  const filler = provisionalAssessment({
    ...INTAKE,
    mediaKind: 'video',
    assurance: 'A',
    mediaByteSize: 4_096,
  });

  expect(real.ratings.visual_strength).toBe(5);
  expect(filler.ratings.visual_strength).toBe(1);
  expect(filler.score.score).toBeLessThan(real.score.score);
});

test('a caller that does not know the size is not punished for it', () => {
  // Optional, because not every caller has it. Absent means unknown, not empty.
  const unknown = provisionalAssessment({ ...INTAKE, mediaKind: 'video', assurance: 'A' });
  expect(unknown.ratings.visual_strength).toBe(5);
});

test('the media floor is one number, shared', () => {
  // The score and the screen both use it. Two copies would drift, and the first
  // sign would be a frame saying "unplayable" beside a visual strength of 5.
  expect(MIN_PLAUSIBLE_MEDIA_BYTES).toBe(64_000);
});
