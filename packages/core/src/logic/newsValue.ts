import { haversineMetres, type LatLng } from '../lib/geo';
import { assuranceMeta } from '../types/assurance';
import { CORROBORATION_CHECKS, type CorroborationRecord } from './editorial';
import type { AssuranceClass } from '../types/assurance';
import type { IncidentCategory, MediaKind } from '../types/api';
import type { HandlingRequirement, Severity } from '../types/context';
import { severityMeta } from '../types/context';
import type { SubmissionDestination } from '../types/dawuro';

/**
 * Whether a report is a top story, and how that judgement is made in the open.
 *
 * Editors weigh news values whether or not anybody writes them down. Writing
 * them down is the whole point: two forces bend the unwritten version — what
 * gets clicks, and what the owner or an advertiser wants elevated — and a
 * criteria that does not name them cannot be checked against them. Everything
 * here exists to make a ranking arguable rather than asserted.
 *
 * Three things are kept strictly apart, and conflating any two of them is how
 * this sort of model goes wrong:
 *
 *   **Gates** are pass/fail and come first. An unverified, unlawful or harmful
 *   report is not a low-scoring top story, it is not a top story. Scoring it at
 *   all invites someone to argue that a big enough number outweighs a child's
 *   identity, and no weighting should ever let that argument start.
 *
 *   **The score** ranks what is left, and only what is left.
 *
 *   **The modifiers** correct for known distortions in Ghanaian newsrooms —
 *   the structural pull toward Accra and Kumasi above all. Two of them are
 *   rules rather than points, because "get a second editor to sign off" is not
 *   something a number can express.
 *
 * **On the arithmetic.** The ten weights sum to 110, so a straight weighted
 * total runs to 550 — but the thresholds this model was specified with (375 /
 * 300 / 225) are stated out of 500, and are exactly 75%, 60% and 45%. The
 * percentages are plainly the intent, so `score` is the weighted total
 * expressed on the 500-point scale those thresholds live on, and the modifiers
 * are in the same units. `rawTotal` keeps the un-normalised figure for anyone
 * checking the sum by hand.
 */

// ─── Stage 1: gates ────────────────────────────────────────────────────────

export type NewsGateId = 'verification' | 'legal' | 'harm' | 'public_interest';

export interface NewsGate {
  id: NewsGateId;
  label: string;
  /** What the editor is actually being asked. */
  question: string;
  /** Why refusing here is not negotiable. */
  because: string;
}

export const NEWS_GATES: NewsGate[] = [
  {
    id: 'verification',
    label: 'Verification',
    question: 'Two independent sources, or one primary document or on-record official?',
    because: 'Virality on social media is a tip, not a source.',
  },
  {
    id: 'legal',
    label: 'Legal',
    question:
      'Free of contempt risk on an active case and of defamation exposure, and compliant with NMC guidelines and the Right to Information Act?',
    because: 'A story that cannot lawfully run is not a story yet.',
  },
  {
    id: 'harm',
    label: 'Harm',
    question:
      'Minors, sexual offence victims and unconvicted suspects protected, and nothing that incites ethnic, religious or partisan violence?',
    because: 'No score outweighs an identified child.',
  },
  {
    id: 'public_interest',
    label: 'Public interest',
    question:
      'If it intrudes on privacy, is the intrusion justified by wrongdoing, danger or misuse of public resources?',
    because: 'Interesting to the public is not the same as in the public interest.',
  },
];

/**
 * Where a gate stands.
 *
 * `unanswered` is a distinct value rather than a false, because "nobody has
 * checked the legal position" and "the legal position is bad" call for opposite
 * actions, and a boolean would report them identically.
 */
export type GateVerdict = 'pass' | 'fail' | 'unanswered';

export type NewsGateAnswers = Record<NewsGateId, GateVerdict>;

export const GATES_UNANSWERED: NewsGateAnswers = {
  verification: 'unanswered',
  legal: 'unanswered',
  harm: 'unanswered',
  public_interest: 'unanswered',
};

/** True only when every gate has been answered and every answer is a pass. */
export function passesAllGates(answers: NewsGateAnswers): boolean {
  return NEWS_GATES.every((g) => answers[g.id] === 'pass');
}

export function failedGates(answers: NewsGateAnswers): NewsGateId[] {
  return NEWS_GATES.filter((g) => answers[g.id] === 'fail').map((g) => g.id);
}

export function unansweredGates(answers: NewsGateAnswers): NewsGateId[] {
  return NEWS_GATES.filter((g) => answers[g.id] === 'unanswered').map((g) => g.id);
}

/**
 * The two gates the platform can answer from its own records.
 *
 * Deliberately only two. Verification and harm are things Dawuro already
 * tracks — corroboration checks and the handling requirements derived from the
 * reporter's consent flags — so asking an editor to re-enter them invites a
 * tired yes. Legal exposure and the public interest test are judgements about
 * the world, and a model that guessed at them would be inventing a legal
 * opinion; those stay `unanswered` until a person answers them.
 *
 * The verification rule mirrors the criteria exactly: two independent sources,
 * *or* one primary document. `official_record` is the primary-document check in
 * Dawuro's vocabulary — a police, agency, utility or court record.
 */
export function deriveGates(input: {
  corroboration: CorroborationRecord;
  handling: HandlingRequirement[];
  redactionApplied: boolean;
}): NewsGateAnswers {
  const done = new Set(input.corroboration.completed);
  const independent = CORROBORATION_CHECKS.filter((c) => c.independent && done.has(c.id));
  const hasPrimaryDocument = done.has('official_record');

  const verification: GateVerdict =
    independent.length >= 2 || hasPrimaryDocument ? 'pass' : 'unanswered';

  /*
   * A failure, not an absence.
   *
   * Footage that needs redaction and has not had it is the one case here that
   * is genuinely known-bad rather than merely unchecked: the reporter said
   * there are children in it, and nobody has obscured them. Leaving that as
   * `unanswered` would let it sit in a queue looking merely incomplete.
   */
  const needsRedaction = input.handling.includes('redact_before_publication');
  const harm: GateVerdict = needsRedaction && !input.redactionApplied ? 'fail' : 'unanswered';

  return { ...GATES_UNANSWERED, verification, harm };
}

// ─── Stage 2: the weighted criteria ────────────────────────────────────────

export type NewsCriterionId =
  | 'impact'
  | 'proximity'
  | 'utility'
  | 'accountability'
  | 'timeliness'
  | 'prominence'
  | 'novelty'
  | 'human_interest'
  | 'continuity'
  | 'visual_strength';

export interface NewsCriterion {
  id: NewsCriterionId;
  label: string;
  /**
   * One or two words, for a queue row.
   *
   * "National impact and magnitude 4/5" is the right label on a panel and does
   * not fit in a 340px column beside a thumbnail — it truncates to "National
   * imp…", which names nothing. The short form is a separate field rather than
   * a substring so the abbreviation is chosen rather than cut.
   */
  short: string;
  weight: number;
  /** Anchors the top of the scale in Ghanaian terms, so a 5 means the same thing twice. */
  fiveLooksLike: string;
}

/**
 * Ten criteria, weighted.
 *
 * The order is the order of the weights, so the thing that matters most is read
 * first. Visual strength is last and worth least on purpose: strong footage
 * supports a story and has never justified one, and a platform built on citizen
 * video has to be especially careful not to let the pictures do the deciding.
 */
export const NEWS_CRITERIA: NewsCriterion[] = [
  {
    id: 'impact',
    label: 'National impact and magnitude',
    short: 'Impact',
    weight: 20,
    fiveLooksLike:
      'Cedi depreciation, a utility tariff hike, a fuel price change, a new tax, a dumsor schedule, a nationwide strike.',
  },
  {
    id: 'proximity',
    label: 'Audience proximity and relevance',
    short: 'Proximity',
    weight: 15,
    fiveLooksLike: 'Affects the specific region and language audience you serve, not just Accra.',
  },
  {
    id: 'utility',
    label: 'Utility and actionability',
    short: 'Useful today',
    weight: 12,
    fiveLooksLike:
      'School placement, BECE or WASSCE results, a flood warning, a road closure, an NHIS or passport process change.',
  },
  {
    id: 'accountability',
    label: 'Accountability and conflict',
    short: 'Accountability',
    weight: 12,
    fiveLooksLike:
      'Procurement fraud, galamsey protection, misuse of state funds, abuse of office.',
  },
  {
    id: 'timeliness',
    label: 'Timeliness and exclusivity',
    short: 'Fresh',
    weight: 12,
    fiveLooksLike: 'Broken first, with documents.',
  },
  {
    id: 'prominence',
    label: 'Prominence of the actors',
    short: 'Prominence',
    weight: 10,
    fiveLooksLike:
      'President, ministers, the Speaker, the EC, the BoG Governor, chiefs, major clergy, the Black Stars.',
  },
  {
    id: 'novelty',
    label: 'Novelty and unexpectedness',
    short: 'Novelty',
    weight: 9,
    fiveLooksLike: 'A reversal, a resignation, a first-ever, a record.',
  },
  {
    id: 'human_interest',
    label: 'Human interest',
    short: 'Human interest',
    weight: 8,
    fiveLooksLike: 'An identifiable person carrying a systemic problem.',
  },
  {
    id: 'continuity',
    label: 'Continuity',
    short: 'Running story',
    weight: 7,
    fiveLooksLike: 'A live thread the audience is already tracking.',
  },
  {
    id: 'visual_strength',
    label: 'Visual and audio strength',
    short: 'Footage',
    weight: 5,
    fiveLooksLike:
      'Footage, an audio leak, strong stills — supports a story but never justifies one.',
  },
];

/** 1 (weakest) to 5 (strongest). Nothing outside that range is meaningful. */
export type Rating = 1 | 2 | 3 | 4 | 5;

export type NewsRatings = Record<NewsCriterionId, Rating>;

/**
 * The midpoint, used wherever nothing is known.
 *
 * Neutral rather than low: a 1 across ten unrated criteria would bury every
 * report that nobody has assessed yet, which is the opposite of the point of an
 * intake queue. Anything scored from this default reports which criteria it
 * could not assess, so a provisional number is never mistaken for a judgement.
 */
export const NEUTRAL_RATING: Rating = 3;

export const NEUTRAL_RATINGS: NewsRatings = Object.fromEntries(
  NEWS_CRITERIA.map((c) => [c.id, NEUTRAL_RATING]),
) as NewsRatings;

const TOTAL_WEIGHT = NEWS_CRITERIA.reduce((sum, c) => sum + c.weight, 0);

/** The scale the thresholds are stated on. See the note at the top of the file. */
export const SCORE_SCALE = 500;

/**
 * Below this, a stored file is not media.
 *
 * Measured on the live service: real captures from the phone are 1.9–3.7 MB,
 * while integration probes sharing the same queue hold 2 048, 4 096 or 8 192
 * bytes of random data with no container header at all. 64 KB sits far above
 * every synthetic payload and far below the smallest plausible capture.
 *
 * Shared so the score and the screen agree. The model rated one of those probes
 * `visual_strength: 5` — a video, Class A, therefore strong footage — while the
 * frame beside it said the file was unplayable. One of them had to be wrong.
 */
export const MIN_PLAUSIBLE_MEDIA_BYTES = 64_000;

/** The weighted total before normalising — the figure you get summing by hand. */
export const MAX_RAW_TOTAL = TOTAL_WEIGHT * 5;

// ─── Stage 3: modifiers ────────────────────────────────────────────────────

/**
 * Ghana-specific corrections, applied to the score rather than baked into it.
 *
 * Separate because they are corrections to a known bias rather than measures of
 * the story. Folding the regional bonus into "proximity" would hide the fact
 * that it exists to counteract a structural Accra–Kumasi pull, and a correction
 * nobody can see is a correction nobody can argue with.
 */
export type NewsModifierId =
  'regional_balance' | 'local_language' | 'ritual_discount' | 'rumour_decay';

export interface NewsModifier {
  id: NewsModifierId;
  label: string;
  points: number;
  why: string;
}

export const NEWS_MODIFIERS: NewsModifier[] = [
  {
    id: 'regional_balance',
    label: 'Under-reported region',
    points: 25,
    why: 'Corrects the structural Accra–Kumasi bias.',
  },
  {
    id: 'local_language',
    label: 'Survives translation',
    points: 15,
    why: 'It holds in Twi, Ga, Ewe, Hausa or Dagbani. A story that only works in English elite framing is narrower than it looks.',
  },
  {
    id: 'ritual_discount',
    label: 'Routine or ceremonial',
    points: -20,
    why: 'A commissioning, a courtesy call, a donation photo-op, a press conference about a press conference.',
  },
  {
    id: 'rumour_decay',
    label: 'No primary source yet',
    points: -30,
    why: 'Forwarded or imported material with nothing primary behind it yet. Run as claims under verification, never as a lead.',
  },
];

export type NewsModifierFlags = Record<NewsModifierId, boolean>;

export const NO_MODIFIERS: NewsModifierFlags = {
  regional_balance: false,
  local_language: false,
  ritual_discount: false,
  rumour_decay: false,
};

// ─── tiers ─────────────────────────────────────────────────────────────────

export type NewsTier = 'lead' | 'top_five' | 'inside' | 'brief';

export interface NewsTierMeta {
  id: NewsTier;
  label: string;
  /** Lowest score that reaches this tier. */
  floor: number;
  placement: string;
}

/** Highest first, so the first match wins. */
export const NEWS_TIERS: NewsTierMeta[] = [
  {
    id: 'lead',
    label: 'Lead story',
    floor: 375,
    placement: 'Top of the bulletin or the front page.',
  },
  {
    id: 'top_five',
    label: 'Top five',
    floor: 300,
    placement: 'Above the fold, in the first block.',
  },
  {
    id: 'inside',
    label: 'Inside',
    floor: 225,
    placement: 'Inside page, or the middle of the bulletin.',
  },
  { id: 'brief', label: 'Brief or drop', floor: 0, placement: 'A brief, the digest, or nothing.' },
];

/**
 * Where a report sits when a gate has not been cleared.
 *
 * The bottom band rather than a separate "blocked" value, so every screen that
 * already renders a tier keeps working and none of them has to learn a new
 * case. What a reader of the desk sees is a report placed at the floor with its
 * score intact beside it, which is the honest description.
 */
const BLOCKED_TIER: NewsTier = 'brief';

export function tierFor(score: number): NewsTier {
  return (NEWS_TIERS.find((t) => score >= t.floor) ?? NEWS_TIERS[NEWS_TIERS.length - 1]!).id;
}

export const NEWS_TIER_META: Record<NewsTier, NewsTierMeta> = Object.fromEntries(
  NEWS_TIERS.map((t) => [t.id, t]),
) as Record<NewsTier, NewsTierMeta>;

/** One tier down, for the election-fairness rule. `brief` is the floor. */
export function demoteTier(tier: NewsTier): NewsTier {
  const index = NEWS_TIERS.findIndex((t) => t.id === tier);
  return NEWS_TIERS[Math.min(index + 1, NEWS_TIERS.length - 1)]!.id;
}

// ─── scoring ───────────────────────────────────────────────────────────────

export interface NewsScore {
  /** The weighted total on the 500-point scale the thresholds are stated on. */
  score: number;
  /** Before modifiers, same scale. Kept so a modifier's effect is visible. */
  baseScore: number;
  /** The un-normalised weighted sum, out of `MAX_RAW_TOTAL`. */
  rawTotal: number;
  tier: NewsTier;
  /** Modifiers that actually applied, with their signed points. */
  applied: { id: NewsModifierId; points: number }[];
  /** Criteria still sitting on the neutral default because nobody rated them. */
  unassessed: NewsCriterionId[];
}

/**
 * The weighted score, with modifiers applied after.
 *
 * Clamped to the scale at both ends. Without that, four modifiers on a
 * near-perfect story produce a score above the maximum, and a reader comparing
 * two numbers has no idea one of them is off the end of the scale.
 */
export function scoreNews(
  ratings: NewsRatings,
  modifiers: NewsModifierFlags = NO_MODIFIERS,
  unassessed: NewsCriterionId[] = [],
  /**
   * Where the four gates stand.
   *
   * **The gates decide the placement, and they were not consulted.** This
   * returned `tierFor(score)` — the tier from the number alone — so a report
   * with three gates unanswered still came back `top_five` if it scored 300,
   * and the desk showed it wearing a "Top five" badge directly beneath the
   * sentence "Pass all four, or it is not a top story at all". The interface
   * was stating a rule the model did not keep, which is worse than not stating
   * it: an editor reads that sentence, sees the badge, and concludes the gates
   * are advisory.
   *
   * The file's own first paragraph says what should happen — "an unverified,
   * unlawful or harmful report is not a low-scoring top story, it is not a top
   * story" — and this is where that becomes true rather than aspirational.
   *
   * Defaulted so existing callers keep their behaviour: with no gates supplied
   * there is nothing to fail, and the tier is the score's.
   */
  gates: NewsGateAnswers | null = null,
): NewsScore {
  const rawTotal = NEWS_CRITERIA.reduce((sum, c) => sum + c.weight * ratings[c.id], 0);
  const baseScore = Math.round((rawTotal / MAX_RAW_TOTAL) * SCORE_SCALE);

  const applied = NEWS_MODIFIERS.filter((m) => modifiers[m.id]).map((m) => ({
    id: m.id,
    points: m.points,
  }));
  const delta = applied.reduce((sum, m) => sum + m.points, 0);
  const score = Math.max(0, Math.min(SCORE_SCALE, baseScore + delta));

  /*
   * A gate is a floor, not a subtraction.
   *
   * The score is left exactly as it is — it measures news value, and lowering
   * it would hide *why* the report is not running and make the number
   * unarguable. What the gates control is placement, so an unresolved gate
   * drops the tier to the bottom band and the score stays there in plain sight
   * saying "this would have led, and here is what is stopping it".
   *
   * Unanswered counts as not passed. An editor who has not yet decided whether
   * a report can lawfully run has not established that it can.
   */
  const earned = tierFor(score);
  const tier = gates && !passesAllGates(gates) ? BLOCKED_TIER : earned;

  return { score, baseScore, rawTotal, tier, applied, unassessed };
}

/** One criterion's share of the score, on the 500-point scale. */
export interface CriterionContribution {
  id: NewsCriterionId;
  label: string;
  /** One or two words, for a queue row. See `NewsCriterion.short`. */
  short: string;
  rating: Rating;
  weight: number;
  /** What this criterion added to the score. */
  points: number;
  /** True when nobody has rated it and it is sitting on the neutral default. */
  unassessed: boolean;
}

/**
 * The working behind a score, criterion by criterion.
 *
 * A ranked queue that shows only a total ranks reports by a number nobody can
 * argue with — which is the opposite of the point. This whole model exists so
 * an ordering can be *checked*: an editor who disagrees that one report outranks
 * another should be able to see which criterion did it and say so.
 *
 * Ordered by contribution, largest first, so the reason a report is where it is
 * reads off the top of the list rather than having to be worked out from ten
 * rows. Criteria nobody has rated are marked rather than hidden — a 3 that was
 * never chosen looks exactly like a 3 that was, and only one of them is a
 * judgement.
 *
 * Rounded per criterion, so the parts can differ from the total by a point or
 * two. Showing exact fractions instead would be arithmetically tidier and
 * useless: nobody reads 54.5454 as a reason.
 */
export function criterionContributions(
  ratings: NewsRatings,
  unassessed: NewsCriterionId[] = [],
): CriterionContribution[] {
  const missing = new Set(unassessed);

  return NEWS_CRITERIA.map((criterion) => ({
    id: criterion.id,
    label: criterion.label,
    short: criterion.short,
    rating: ratings[criterion.id],
    weight: criterion.weight,
    points: Math.round(((criterion.weight * ratings[criterion.id]) / MAX_RAW_TOTAL) * SCORE_SCALE),
    unassessed: missing.has(criterion.id),
  })).sort((a, b) => b.points - a.points || b.weight - a.weight);
}

/** Above this, a rating is a strength worth naming. */
const STRENGTH = 4;

/**
 * The shortest true answer to "why is this one above that one?".
 *
 * Two constraints, and the second is the one that took a live queue to see.
 *
 * **Only criteria that were actually assessed.** Saying "ranked on continuity"
 * about a default nobody chose invents a reason, which is worse than giving
 * none.
 *
 * **Only criteria that are actually strong.** Ranking the contributions by
 * points alone put "Impact 2/5" at the head of most rows — arithmetically true,
 * because a criterion weighted 20 outscores one weighted 5 even when it is
 * rated badly, and communicatively nonsense. An operator reading "why is this
 * here? impact 2 out of 5" learns nothing, and worse, reads a weakness as a
 * justification.
 *
 * So a reason has to be a strength. A report with none returns an empty list
 * and the caller says so — "nothing stands out yet" is a real answer, and it is
 * the honest one for a report ranked by weighting rather than by merit.
 */
export function leadingReasons(
  ratings: NewsRatings,
  unassessed: NewsCriterionId[] = [],
  count = 2,
): CriterionContribution[] {
  return criterionContributions(ratings, unassessed)
    .filter((c) => !c.unassessed && c.rating >= STRENGTH)
    .slice(0, count);
}

// ─── the election-period rule ──────────────────────────────────────────────

export interface ElectionFairnessInput {
  /** Campaign season. Set by the newsroom, not inferred from a date here. */
  inCampaignPeriod: boolean;
  /** The story carries a partisan claim, either way. */
  partisanClaim: boolean;
  /** The other side has answered within the same news cycle. */
  hasSameCycleResponse: boolean;
}

/**
 * During a campaign, an unanswered partisan claim drops a tier.
 *
 * A rule rather than points, because the remedy is a response and not an
 * adjustment — and because it has to apply to the NPP and the NDC identically,
 * which a discretionary number would not. The threshold is the top-five floor:
 * below that the story is not being elevated, so the fairness problem this
 * guards against does not arise.
 *
 * `inCampaignPeriod` is passed in rather than worked out from today's date.
 * A campaign season is a decision the newsroom makes, and a library that
 * silently started demoting stories because of its own calendar would be
 * changing editorial policy without being asked.
 */
export function applyElectionFairness(score: NewsScore, input: ElectionFairnessInput): NewsScore {
  const engaged =
    input.inCampaignPeriod &&
    input.partisanClaim &&
    !input.hasSameCycleResponse &&
    score.score >= NEWS_TIER_META.top_five.floor;

  if (!engaged) return score;
  return { ...score, tier: demoteTier(score.tier) };
}

/**
 * Whether a second editor must sign this off before it runs.
 *
 * The score is deliberately untouched. The conflict is not evidence that the
 * story is worth less — it may be the most important thing the outlet has —
 * it is evidence that the person judging it should not be judging it alone.
 * Discounting the score instead would bury exactly the stories an outlet is
 * least willing to run about itself.
 */
export function needsSecondEditor(input: {
  involvesOwner: boolean;
  involvesAdvertiser: boolean;
  involvesAffiliatedParty: boolean;
}): boolean {
  return input.involvesOwner || input.involvesAdvertiser || input.involvesAffiliatedParty;
}

// ─── Stage 4: tie-breaks ───────────────────────────────────────────────────

export type TieBreakReason =
  'changes_what_a_reader_does' | 'exclusive' | 'named_on_record_source' | 'outside_greater_accra';

export const TIE_BREAK_LABEL: Record<TieBreakReason, string> = {
  changes_what_a_reader_does: 'Changes what a reader does today',
  exclusive: 'Exclusively ours',
  named_on_record_source: 'Named, on-record source',
  outside_greater_accra: 'Outside Greater Accra',
};

/** Two stories are close enough to need a tie-break inside this many points. */
export const TIE_BREAK_WINDOW = 25;

export interface TieBreakCandidate {
  score: NewsScore;
  ratings: NewsRatings;
  hasNamedOnRecordSource: boolean;
  region: GhanaRegionId | null;
}

export interface TieBreakOutcome {
  /** -1 when `a` wins, 1 when `b` wins, 0 when nothing separates them. */
  order: -1 | 0 | 1;
  /** Null when the scores were never close enough to need one. */
  reason: TieBreakReason | null;
}

/**
 * Which of two close stories leads.
 *
 * Only engages inside the window — outside it the score already decided, and a
 * tie-break that overrode a comfortable win would make the score decorative.
 * The order of the rules is the order in the criteria, and it is not arbitrary:
 * usefulness to a reader outranks the newsroom's own interest in an exclusive,
 * which outranks geography.
 */
export function breakTie(a: TieBreakCandidate, b: TieBreakCandidate): TieBreakOutcome {
  if (Math.abs(a.score.score - b.score.score) > TIE_BREAK_WINDOW) {
    return { order: a.score.score > b.score.score ? -1 : 1, reason: null };
  }

  const tests: { reason: TieBreakReason; of: (c: TieBreakCandidate) => number }[] = [
    { reason: 'changes_what_a_reader_does', of: (c) => c.ratings.utility },
    { reason: 'exclusive', of: (c) => c.ratings.timeliness },
    { reason: 'named_on_record_source', of: (c) => (c.hasNamedOnRecordSource ? 1 : 0) },
    {
      reason: 'outside_greater_accra',
      of: (c) => (c.region && c.region !== 'greater_accra' ? 1 : 0),
    },
  ];

  for (const test of tests) {
    const left = test.of(a);
    const right = test.of(b);
    if (left !== right) return { order: left > right ? -1 : 1, reason: test.reason };
  }

  return { order: 0, reason: null };
}

// ─── Ghana's regions ───────────────────────────────────────────────────────

export type GhanaRegionId =
  | 'ahafo'
  | 'ashanti'
  | 'bono'
  | 'bono_east'
  | 'central'
  | 'eastern'
  | 'greater_accra'
  | 'north_east'
  | 'northern'
  | 'oti'
  | 'savannah'
  | 'upper_east'
  | 'upper_west'
  | 'volta'
  | 'western'
  | 'western_north';

export interface GhanaRegion {
  id: GhanaRegionId;
  name: string;
  capital: string;
  /** The regional capital's coordinates — the anchor the nearest-region guess uses. */
  at: LatLng;
  /**
   * Whether a story from here earns the regional-balance bonus.
   *
   * The seven regions named in the criteria. Six of them were created in 2019
   * and none has the newsroom presence Accra and Kumasi do, which is the bias
   * the bonus exists to push back against.
   */
  underReported: boolean;
}

export const GHANA_REGIONS: GhanaRegion[] = [
  {
    id: 'ahafo',
    name: 'Ahafo',
    capital: 'Goaso',
    at: { latitude: 6.8, longitude: -2.52 },
    underReported: false,
  },
  {
    id: 'ashanti',
    name: 'Ashanti',
    capital: 'Kumasi',
    at: { latitude: 6.688, longitude: -1.624 },
    underReported: false,
  },
  {
    id: 'bono',
    name: 'Bono',
    capital: 'Sunyani',
    at: { latitude: 7.34, longitude: -2.328 },
    underReported: false,
  },
  {
    id: 'bono_east',
    name: 'Bono East',
    capital: 'Techiman',
    at: { latitude: 7.583, longitude: -1.938 },
    underReported: true,
  },
  {
    id: 'central',
    name: 'Central',
    capital: 'Cape Coast',
    at: { latitude: 5.106, longitude: -1.246 },
    underReported: false,
  },
  {
    id: 'eastern',
    name: 'Eastern',
    capital: 'Koforidua',
    at: { latitude: 6.094, longitude: -0.259 },
    underReported: false,
  },
  {
    id: 'greater_accra',
    name: 'Greater Accra',
    capital: 'Accra',
    at: { latitude: 5.604, longitude: -0.187 },
    underReported: false,
  },
  {
    id: 'north_east',
    name: 'North East',
    capital: 'Nalerigu',
    at: { latitude: 10.524, longitude: -0.368 },
    underReported: true,
  },
  {
    id: 'northern',
    name: 'Northern',
    capital: 'Tamale',
    at: { latitude: 9.404, longitude: -0.839 },
    underReported: false,
  },
  {
    id: 'oti',
    name: 'Oti',
    capital: 'Dambai',
    at: { latitude: 8.065, longitude: 0.178 },
    underReported: true,
  },
  {
    id: 'savannah',
    name: 'Savannah',
    capital: 'Damongo',
    at: { latitude: 9.083, longitude: -1.818 },
    underReported: true,
  },
  {
    id: 'upper_east',
    name: 'Upper East',
    capital: 'Bolgatanga',
    at: { latitude: 10.787, longitude: -0.851 },
    underReported: true,
  },
  {
    id: 'upper_west',
    name: 'Upper West',
    capital: 'Wa',
    at: { latitude: 10.061, longitude: -2.501 },
    underReported: true,
  },
  {
    id: 'volta',
    name: 'Volta',
    capital: 'Ho',
    at: { latitude: 6.611, longitude: 0.471 },
    underReported: false,
  },
  {
    id: 'western',
    name: 'Western',
    capital: 'Sekondi-Takoradi',
    at: { latitude: 4.934, longitude: -1.758 },
    underReported: false,
  },
  {
    id: 'western_north',
    name: 'Western North',
    capital: 'Sefwi Wiawso',
    at: { latitude: 6.213, longitude: -2.486 },
    underReported: true,
  },
];

export const GHANA_REGION_META: Record<GhanaRegionId, GhanaRegion> = Object.fromEntries(
  GHANA_REGIONS.map((r) => [r.id, r]),
) as Record<GhanaRegionId, GhanaRegion>;

/**
 * The region a set of coordinates most likely falls in — a guess, not a lookup.
 *
 * Nearest regional capital, which is not the same thing as the region the point
 * is actually in: capitals are not centroids, regions are not circles, and a
 * point near a boundary or in an elongated region can come back wrong. Real
 * boundaries would need polygons this package has no organisation carrying.
 *
 * That is an acceptable trade only because of how the answer is used: it
 * suggests a +25 modifier and a tie-break, both of which an editor sets and can
 * override. It is named `nearest` so no caller mistakes it for authoritative,
 * and it returns the distance so a far-away match — anything outside Ghana,
 * say — can be treated with suspicion.
 */
export function nearestRegion(at: LatLng): { region: GhanaRegion; metres: number } {
  let best = GHANA_REGIONS[0]!;
  let bestMetres = Number.POSITIVE_INFINITY;

  for (const region of GHANA_REGIONS) {
    const metres = haversineMetres(at, region.at);
    if (metres < bestMetres) {
      best = region;
      bestMetres = metres;
    }
  }

  return { region: best, metres: bestMetres };
}

/**
 * Beyond this from every regional capital, the guess is not worth making.
 *
 * Ghana is about 670 km across, so a point more than 250 km from the nearest
 * capital is almost certainly outside the country — a bad fix, or a report from
 * elsewhere. Returning "Upper West, probably" for a coordinate in Burkina Faso
 * would hand out the under-reported bonus for being off the map.
 */
const REGION_GUESS_LIMIT_M = 250_000;

export function regionFromCoordinates(location: {
  latitude: number | null;
  longitude: number | null;
}): GhanaRegion | null {
  if (location.latitude === null || location.longitude === null) return null;
  const { region, metres } = nearestRegion({
    latitude: location.latitude,
    longitude: location.longitude,
  });
  return metres <= REGION_GUESS_LIMIT_M ? region : null;
}

// ─── the provisional score every report gets on arrival ────────────────────

/**
 * Which criteria the platform can evidence, and which need a person.
 *
 * The split is the honest part of this module. Dawuro knows when something was
 * filmed, where, what the reporter called it, how urgent they said it was, and
 * what the file is — so timeliness, utility, accountability, impact and visual
 * strength can be seeded from real data. It knows nothing about who is involved,
 * whether this is a first, whether an audience is already following it, or which
 * audience an outlet serves. Those five are left neutral and reported as
 * unassessed rather than guessed at, because a guess dressed as a rating is
 * worse than a gap: it looks like it was considered.
 */
export const DERIVABLE_CRITERIA: NewsCriterionId[] = [
  'impact',
  'utility',
  'accountability',
  'timeliness',
  'visual_strength',
];

const clampRating = (n: number): Rating => Math.max(1, Math.min(5, Math.round(n))) as Rating;

/**
 * Categories where knowing about it changes what somebody does today.
 *
 * The test is a decision, not a topic: a closed road, water off, a flood, an
 * outbreak. Someone reads it and takes a different route, fills a bucket, keeps
 * a child home. That is what the utility criterion measures.
 */
const ACTIONABLE: IncidentCategory[] = [
  'flood',
  'fire',
  'accident',
  'weather',
  'health',
  'road',
  'transport',
  'utility',
  'water',
  'sanitation',
];

/**
 * Categories that are on their face about the use of public power or money.
 *
 * Two tiers rather than one. Corruption, galamsey and election stories are
 * accountability journalism by definition; a chieftaincy or land dispute or a
 * protest is conflict, which the criterion also covers but which does not
 * always turn out to be about anybody's conduct in office. A single bucket
 * would have to pick one of those to be wrong about.
 */
const ACCOUNTABILITY_STRONG: IncidentCategory[] = [
  'corruption',
  'whistleblower',
  'galamsey',
  'election',
];
const ACCOUNTABILITY_MODERATE: IncidentCategory[] = [
  'chieftaincy',
  'land',
  'protest',
  'disorder',
  'environment',
];

export interface ProvisionalInput {
  category: IncidentCategory;
  severity: Severity;
  mediaKind: MediaKind;
  assurance: AssuranceClass;
  destination: SubmissionDestination | null;
  capturedAtIso: string | null;
  nowIso: string;
  location: { latitude: number | null; longitude: number | null };
  corroboration: CorroborationRecord;
  /**
   * What the stored file weighs, when the caller knows.
   *
   * Optional because not every caller has it. When it is present and below
   * `MIN_PLAUSIBLE_MEDIA_BYTES`, there is no footage to be strong — see
   * `visual_strength` below.
   */
  mediaByteSize?: number | null;
}

export interface ProvisionalAssessment {
  ratings: NewsRatings;
  modifiers: NewsModifierFlags;
  score: NewsScore;
  region: GhanaRegion | null;
  /** The criteria a person still has to rate. */
  unassessed: NewsCriterionId[];
}

/**
 * A first score for a report the moment it arrives, from data alone.
 *
 * Its job is to order an intake queue, not to decide a bulletin. Half the
 * criteria cannot be evidenced without a person and are held at the neutral
 * midpoint, which is why every caller is handed `unassessed` alongside the
 * number — a screen that shows the score without showing what went unassessed
 * is presenting a placeholder as a judgement.
 *
 * Nothing here reads a clock of its own: `nowIso` is passed in, so the same
 * inputs always produce the same score and a test can pin one.
 */
export function provisionalAssessment(input: ProvisionalInput): ProvisionalAssessment {
  /*
   * Severity is the reporter's claim about urgency, not a measure of how many
   * people are affected — so it is evidence for impact, and weak evidence. It
   * is capped below 5: a 5 here means nationwide, and nobody standing in front
   * of one incident is in a position to tell us that.
   */
  const impact = clampRating(Math.min(4, severityMeta(input.severity).weight));

  const utility = ACTIONABLE.includes(input.category) ? 4 : 2;
  const accountability = ACCOUNTABILITY_STRONG.includes(input.category)
    ? 4
    : ACCOUNTABILITY_MODERATE.includes(input.category)
      ? 3
      : 2;

  /*
   * Timeliness decays by the hour, and exclusivity is what reaches the top.
   *
   * The criterion is timeliness *and* exclusivity together, and a 5 on it means
   * "broken first, with documents" — so age alone stops at 4 and the last point
   * is only available to something still ours: sent to named organisations, or
   * offered to the marketplace and not yet licensed. A report already sitting on
   * the public feed is timely but nobody's exclusive.
   *
   * Age topping out at 5 by itself made the exclusivity bonus invisible on
   * anything filmed in the last six hours, which is most of an intake queue —
   * the two halves of the criterion collapsed into one.
   */
  const hours = hoursSince(input.capturedAtIso, input.nowIso);
  const freshness = hours === null ? 2 : hours < 6 ? 4 : hours < 24 ? 3 : hours < 72 ? 2 : 1;
  const exclusive = input.destination === 'directed' || input.destination === 'marketplace';
  const timeliness = clampRating(freshness + (exclusive ? 1 : 0));

  /*
   * The one criterion the platform knows better than an editor could from a
   * summary: it has the file.
   *
   * Class A and D were captured through the app or by a trained field officer,
   * with the original preserved — stronger material than the same pictures
   * forwarded through three phones and imported from a gallery, which is Class
   * C. This is about the footage as footage, not about whether the claim is
   * true; that is what the verification gate is for.
   */
  const base = input.mediaKind === 'video' ? 4 : input.mediaKind === 'photo' ? 3 : 1;
  const provenanceBonus = input.assurance === 'A' || input.assurance === 'D' ? 1 : 0;

  /*
   * A file too small to be media has no visual strength at all.
   *
   * The kind and the assurance class describe what a capture *claims* to be,
   * and both can be right about a file with nothing in it: a 4 KB upload
   * recorded as `kind: video, assurance: A` scored 5 out of 5 for footage while
   * the frame beside it said the file was unplayable. The queue was ranking a
   * report on pictures nobody could watch.
   */
  const noUsableFile =
    typeof input.mediaByteSize === 'number' && input.mediaByteSize < MIN_PLAUSIBLE_MEDIA_BYTES;
  const visual_strength = noUsableFile ? 1 : clampRating(base + provenanceBonus);

  const ratings: NewsRatings = {
    ...NEUTRAL_RATINGS,
    impact,
    utility,
    accountability,
    timeliness,
    visual_strength,
  };

  const region = regionFromCoordinates(input.location);
  const done = new Set(input.corroboration.completed);
  const hasIndependent = CORROBORATION_CHECKS.some((c) => c.independent && done.has(c.id));

  /*
   * Rumour decay is about *provenance*, not about how much checking has been
   * done yet.
   *
   * The criterion describes something "trending on X or TikTok but with no
   * primary source yet". Read as "nothing independent recorded", it fired on
   * every report on the routing desk — corroboration is editorial work and has
   * not started there — so a −30 that can never vary was taken off every score
   * on the queue. Measured against the live service: nine of nine reports, all
   * penalised identically. A modifier that applies to everything ranks nothing.
   *
   * It was also simply wrong about them. Those nine are Class A: captured in
   * the app, signature valid, time and location checks passed, original
   * preserved. That footage *is* a primary source of the thing it shows. The
   * report this criterion describes is Class C — "imported from a gallery,
   * messaging app, web form or third party", which the assurance model already
   * marks as usable only as a lead until independently corroborated.
   *
   * So it is tied to that instead: material that cannot stand alone, and
   * nothing independent behind it yet. It still lifts the moment a check is
   * recorded, so it stays a prompt rather than a verdict.
   */
  const cannotStandAlone = !assuranceMeta(input.assurance).usableAlone;

  const modifiers: NewsModifierFlags = {
    ...NO_MODIFIERS,
    regional_balance: region?.underReported ?? false,
    rumour_decay: cannotStandAlone && !hasIndependent,
  };

  const unassessed = NEWS_CRITERIA.map((c) => c.id).filter(
    (id) => !DERIVABLE_CRITERIA.includes(id),
  );

  return {
    ratings,
    modifiers,
    score: scoreNews(ratings, modifiers, unassessed),
    region,
    unassessed,
  };
}

function hoursSince(iso: string | null, nowIso: string): number | null {
  if (!iso) return null;
  const then = Date.parse(iso);
  const now = Date.parse(nowIso);
  if (!Number.isFinite(then) || !Number.isFinite(now)) return null;
  return Math.max(0, (now - then) / 3_600_000);
}
