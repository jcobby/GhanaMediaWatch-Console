import type { VettingState } from './api';

/**
 * How much is known about where a piece of media came from, and how far
 * editorial has got in checking what it shows.
 *
 * These are two separate questions and the platform must never conflate them:
 *
 *   - **Assurance class** answers "was this captured through the trusted app,
 *     and is the stored file unchanged?" It is a technical fact.
 *   - **Verification state** answers "is the claim about what it depicts
 *     substantively true?" That is an editorial judgement no amount of
 *     cryptography can produce.
 *
 * A file can be Class A — perfect integrity, valid signature, GPS and clock
 * agreeing — and still show a staged event. Saying "verified" because the hash
 * checked out is the single most damaging mistake this platform could make, so
 * the two are modelled apart and the language allowed for each is enumerated
 * rather than left to whoever writes the UI.
 */

// ─── assurance class ───────────────────────────────────────────────────────

export type AssuranceClass = 'A' | 'B' | 'C' | 'D';

export interface AssuranceMeta {
  label: string;
  /** The only phrase that may be shown to describe this class. */
  permittedLabel: string;
  description: string;
  /** Class A skips the queue; nothing else does. */
  expeditedReview: boolean;
  /** Whether it may stand alone, or only ever serve as a lead. */
  usableAlone: boolean;
  hue: string;
}

export const ASSURANCE_META: Record<AssuranceClass, AssuranceMeta> = {
  A: {
    label: 'Trusted capture',
    permittedLabel: 'Assured capture integrity',
    description:
      'Captured in the app, signature valid, time and location checks passed, original preserved.',
    expeditedReview: true,
    usableAlone: true,
    hue: '#0B7A4B',
  },
  B: {
    label: 'Trusted capture with flags',
    permittedLabel: 'Capture integrity partially verified',
    description: 'Captured in the app, but one or more checks are incomplete or anomalous.',
    expeditedReview: false,
    usableAlone: true,
    hue: '#A25C00',
  },
  C: {
    label: 'External upload',
    permittedLabel: 'Origin not technically verified',
    description: 'Imported from a gallery, messaging app, web form or third party.',
    expeditedReview: false,
    // The doc is explicit: usable only as a lead unless independently
    // corroborated. Encoded rather than left to editorial memory.
    usableAlone: false,
    hue: '#C1121F',
  },
  D: {
    label: 'Institutional evidence',
    permittedLabel: 'Authorised institutional capture',
    description:
      'Captured by a trained field officer under enhanced identity and workflow controls.',
    expeditedReview: true,
    usableAlone: true,
    hue: '#1D4ED8',
  },
};

/**
 * The technical facts a class is derived from.
 *
 * Every field is something a machine can establish. Nothing here is a
 * judgement, which is what keeps the classification reproducible.
 */
export interface CaptureFacts {
  /** False for anything imported rather than recorded in the app. */
  capturedInApp: boolean;
  /** The stored file still matches the signature taken at capture. */
  integritySignatureValid: boolean;
  /** Device clock agreed with server time within tolerance. */
  timeCheckPassed: boolean;
  /** A fix of usable accuracy was held throughout. */
  locationCheckPassed: boolean;
  /** Device was not rooted, emulated or otherwise flagged. */
  deviceCheckPassed: boolean;
  /** The untouched original is still held. */
  originalPreserved: boolean;
  /** Recorded by an accredited officer under institutional controls. */
  institutionalCapture: boolean;
}

/**
 * Classify a capture.
 *
 * Order is deliberate. An import can never be rescued into a trusted class by
 * other checks passing, so that test comes first — otherwise a gallery file
 * with a plausible clock would classify as institutional evidence.
 */
export function assuranceClass(facts: CaptureFacts): AssuranceClass {
  if (!facts.capturedInApp) return 'C';
  if (facts.institutionalCapture) return 'D';

  const allChecksPassed =
    facts.integritySignatureValid &&
    facts.timeCheckPassed &&
    facts.locationCheckPassed &&
    facts.deviceCheckPassed &&
    facts.originalPreserved;

  return allChecksPassed ? 'A' : 'B';
}

/** Which specific checks failed, for a reviewer who needs to know why. */
export function failedChecks(facts: CaptureFacts): string[] {
  const failures: string[] = [];
  if (!facts.integritySignatureValid) failures.push('Integrity signature invalid');
  if (!facts.timeCheckPassed) failures.push('Device clock disagreed with server time');
  if (!facts.locationCheckPassed) failures.push('Location accuracy insufficient');
  if (!facts.deviceCheckPassed) failures.push('Device or session flagged');
  if (!facts.originalPreserved) failures.push('Original not preserved');
  return failures;
}

// ─── verification state ────────────────────────────────────────────────────

export type VerificationState =
  | 'received_unreviewed'
  | 'integrity_passed'
  | 'integrity_flagged'
  | 'corroboration_in_progress'
  | 'verified_high_confidence'
  | 'verified_in_part'
  | 'disputed'
  | 'rejected';

export interface VerificationMeta {
  label: string;
  meaning: string;
  /**
   * The sentence the interface is allowed to show.
   *
   * Enumerated because this is a legal exposure, not a copy decision. "Capture
   * integrity verified" and "event verified" are different claims, and a
   * product that lets them blur will eventually publish the second while only
   * having established the first.
   */
  permittedRepresentation: string;
  /** May the public feed carry it. */
  publishable: boolean;
  /** May a subscriber license and act on it. */
  licensable: boolean;
  /** May the word "verified" appear against it in any surface. */
  mayUseWordVerified: boolean;
  hue: string;
}

export const VERIFICATION_META: Record<VerificationState, VerificationMeta> = {
  received_unreviewed: {
    label: 'Received',
    meaning: 'Submission exists; no editorial conclusion.',
    permittedRepresentation: 'Never describe as verified.',
    publishable: false,
    licensable: false,
    mayUseWordVerified: false,
    hue: '#7A7F94',
  },
  integrity_passed: {
    label: 'Integrity passed',
    meaning: 'Trusted-capture and stored-file controls passed.',
    // The distinction the whole model exists to protect.
    permittedRepresentation: 'Capture integrity verified — not event verified.',
    publishable: false,
    licensable: true,
    mayUseWordVerified: false,
    hue: '#1D4ED8',
  },
  integrity_flagged: {
    label: 'Integrity flagged',
    meaning: 'One or more technical checks require review.',
    permittedRepresentation: 'Show the specific flag to authorised reviewers only.',
    publishable: false,
    licensable: false,
    mayUseWordVerified: false,
    hue: '#A25C00',
  },
  corroboration_in_progress: {
    label: 'Corroborating',
    meaning: 'Editorial is checking the source and the claim.',
    permittedRepresentation: 'May be shared only as a lead, where policy allows.',
    publishable: false,
    licensable: true,
    mayUseWordVerified: false,
    hue: '#0E7490',
  },
  verified_high_confidence: {
    label: 'Verified',
    meaning: 'Sufficient corroboration for the stated facts and use.',
    permittedRepresentation: 'Publish or license, stating the basis and its limitations.',
    publishable: true,
    licensable: true,
    mayUseWordVerified: true,
    hue: '#0B7A4B',
  },
  verified_in_part: {
    label: 'Partly verified',
    meaning: 'Some elements established; others unresolved.',
    permittedRepresentation: 'State precisely what is and is not verified.',
    publishable: true,
    licensable: true,
    mayUseWordVerified: true,
    hue: '#65A30D',
  },
  disputed: {
    label: 'Disputed',
    meaning: 'Credible contradictory information or a correction exists.',
    permittedRepresentation: 'Attach the update history; do not syndicate stale copies.',
    publishable: false,
    licensable: false,
    mayUseWordVerified: false,
    hue: '#C026D3',
  },
  rejected: {
    label: 'Rejected',
    meaning: 'Fabricated, harmful, illegal, irrelevant, unsafe or compromised.',
    permittedRepresentation: 'Restricted audit retention only.',
    publishable: false,
    licensable: false,
    mayUseWordVerified: false,
    hue: '#C1121F',
  },
};

export const VERIFICATION_STATES: VerificationState[] = [
  'received_unreviewed',
  'integrity_passed',
  'integrity_flagged',
  'corroboration_in_progress',
  'verified_high_confidence',
  'verified_in_part',
  'disputed',
  'rejected',
];

/**
 * Whether an editor may move a report from one state to another.
 *
 * Two rules are structural rather than procedural:
 *
 *   - Nothing reaches a verified state without passing through corroboration.
 *     Verification is the act of corroborating; allowing the jump would let one
 *     click turn an unreviewed submission into a published fact.
 *   - Rejected is terminal. Reinstating something judged fabricated or unsafe
 *     must be a new submission with a new record, not an edit that quietly
 *     erases the judgement.
 */
const ALLOWED_TRANSITIONS: Record<VerificationState, VerificationState[]> = {
  received_unreviewed: ['integrity_passed', 'integrity_flagged', 'rejected'],
  integrity_passed: ['corroboration_in_progress', 'integrity_flagged', 'rejected'],
  integrity_flagged: ['integrity_passed', 'corroboration_in_progress', 'rejected'],
  corroboration_in_progress: [
    'verified_high_confidence',
    'verified_in_part',
    'disputed',
    'rejected',
  ],
  verified_high_confidence: ['verified_in_part', 'disputed', 'rejected'],
  verified_in_part: ['verified_high_confidence', 'disputed', 'rejected'],
  disputed: ['corroboration_in_progress', 'verified_in_part', 'rejected'],
  rejected: [],
};

export function canTransition(from: VerificationState, to: VerificationState): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function nextStates(from: VerificationState): VerificationState[] {
  return ALLOWED_TRANSITIONS[from];
}

/**
 * Whether a report may be published, taking assurance into account.
 *
 * A Class C upload can never stand alone however far editorial gets, so the
 * class gates the state rather than the other way round: an external file that
 * an editor marked verified is still only usable as corroborated material,
 * and `usableAlone` is what says so.
 */
/**
 * The verification meta for a value that came off the wire.
 *
 * **`VERIFICATION_META[state]` is a crash waiting for one unrecognised
 * string.** It is a `Record<VerificationState, …>`, and that is a promise
 * TypeScript can keep only about values TypeScript produced — while every value
 * these screens index it with arrives as JSON from a service that publishes no
 * response schema for half its endpoints.
 *
 * `/editorial/decided` proved it. The page mapped its rows to an incident shape
 * that turned out to be wrong, indexed this record with `undefined`, and took
 * the entire route down: *Cannot read properties of undefined (reading
 * 'permittedRepresentation')*. A desk showing nothing at all because one row
 * was shaped differently is a far worse failure than a row reading
 * "unrecognised".
 *
 * So server data comes through here, and the fallback is deliberately the most
 * cautious entry there could be: not publishable, not licensable, and the word
 * "verified" not permitted. A state this client does not understand must never
 * be treated as one that clears a gate.
 *
 * Values the client itself produced — iterating `nextStates`, a constant, a
 * decision the operator just made — may index the record directly. That
 * distinction is the whole rule.
 */
export function verificationMeta(state: string | null | undefined): VerificationMeta {
  return VERIFICATION_META[state as VerificationState] ?? UNRECOGNISED_VERIFICATION;
}

const UNRECOGNISED_VERIFICATION: VerificationMeta = {
  label: 'Unrecognised state',
  meaning: 'This console does not know this verification state.',
  permittedRepresentation:
    'This console does not recognise the state recorded against this report, so it cannot say what may be claimed about it. Treat it as unverified.',
  publishable: false,
  licensable: false,
  mayUseWordVerified: false,
  hue: '#64748b',
};

/**
 * The assurance meta for a value that came off the wire. See `verificationMeta`.
 *
 * The fallback is the most cautious class there could be: not usable alone, no
 * expedited review. A capture class this client has never seen is not one to
 * put in front of the public on its own.
 */
export function assuranceMeta(assurance: string | null | undefined): AssuranceMeta {
  return ASSURANCE_META[assurance as AssuranceClass] ?? UNRECOGNISED_ASSURANCE;
}

const UNRECOGNISED_ASSURANCE: AssuranceMeta = {
  label: 'Unrecognised class',
  permittedLabel: 'Capture integrity unknown',
  description:
    'This console does not recognise the capture assurance class recorded against this report.',
  expeditedReview: false,
  usableAlone: false,
  hue: '#64748b',
};

export function canPublishReport(
  state: VerificationState,
  assurance: AssuranceClass,
  independentlyCorroborated = false,
): boolean {
  if (!VERIFICATION_META[state].publishable) return false;
  if (!ASSURANCE_META[assurance].usableAlone && !independentlyCorroborated) return false;
  return true;
}

/** Whether a subscriber may license and act on it. */
export function canLicenseReport(state: VerificationState): boolean {
  return VERIFICATION_META[state].licensable;
}

/**
 * The legacy four-state value the public feed still renders.
 *
 * Kept so the existing feed keeps working while the eight-state model becomes
 * the source of truth. Everything collapses toward the safer value: anything
 * not publishable reads as pending rather than published.
 */
export function vettingStateFor(state: VerificationState): VettingState {
  if (state === 'rejected') return 'rejected';
  if (state === 'disputed' || state === 'integrity_flagged') return 'restricted';
  if (VERIFICATION_META[state].publishable) return 'published';
  return 'pending_review';
}
