import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DocumentId, StepState } from '@dawuro/core';

/**
 * Organisation applications the console holds itself.
 *
 * **The flow this serves.** An organisation registers, goes straight into the
 * onboarding forms, and submits them; the application then reaches the Dawuro
 * owner to approve or reject. That is one continuous act from the applicant's
 * side, and every part of it needs somewhere to live between the steps.
 *
 * **Why the console holds it.** The backend has nowhere to put any of it.
 * `POST /auth/register` is documented as "Register a reporter account", every
 * `/org/*` route requires membership of an organisation that already exists,
 * and `/platform/applications` only lists — there is no POST on it, or anywhere
 * else, that files an application. Verified against the live spec.
 *
 * So the details went into the applicant's session cookie and nowhere else.
 * They were invisible to every operator, and gone the moment the applicant
 * signed out. The onboarding wizard was worse: pure React state with no request
 * behind it, so an applicant could fill in four steps, attach five documents,
 * press submit, and have all of it discarded on navigation.
 *
 * **What this is, and is not.** A real record of a real submission, kept until
 * the backend can accept it. Never fixture data, and it never invents an
 * applicant. It is also not a substitute for the backend: approving an
 * application here records the decision and does not create an organisation,
 * because no endpoint does, and the approvals screen says so where it is
 * clicked rather than leaving an operator to assume otherwise.
 *
 * **Delete this module** when the backend can file an application.
 * `migrationPayload()` makes that a data move rather than a rewrite.
 *
 * Node-only, and deliberately not edge-safe: middleware must not read it. That
 * is why an applicant's pending state is mirrored onto their session at
 * sign-in, where the edge can see it.
 */

/** Where the file lives. Overridable so tests never touch the real one. */
function storePath(): string {
  const override = process.env.DAWURO_APPLICATIONS_FILE;
  if (override) return override;
  return path.join(process.cwd(), '.data', 'applications.json');
}

/** Where uploaded evidence lives, beside the file that indexes it. */
export function documentsRoot(): string {
  return path.join(path.dirname(storePath()), 'documents');
}

/**
 * How far an application has got.
 *
 * `draft` and `submitted` are the distinction the whole flow turns on: an
 * operator must see an application once its forms are filled in, and must not
 * see one that is still being typed. Merging them would put half-finished
 * applications in the approvals queue, which is how a reviewer ends up
 * rejecting somebody for not having attached a document yet.
 */
export type ApplicationStatus = 'draft' | 'submitted' | 'approved' | 'rejected';

/** A document the applicant attached, and where its bytes are kept. */
export interface StoredDocument {
  id: DocumentId;
  fileName: string;
  /** Path relative to `documentsRoot()`. */
  storedAs: string;
  byteSize: number;
  contentType: string;
  uploadedAtIso: string;
}

/** What the wizard collects, step by step. */
export interface OnboardingProgress {
  organisation: { legalName: string; registrationNumber: string; tin: string };
  officer: { name: string; role: string; idNumber: string; phone: string };
  coverage: { address: string; city: string; areaLabel: string; radiusKm: string };
  documents: StoredDocument[];
  steps: StepState[];
}

export interface HeldApplication {
  id: string;
  /** The account the backend really did create, so this row has an owner. */
  accountEmail: string;
  organisationName: string;
  sector: string;
  contactName: string;
  email: string;
  phone: string;
  /** What routing would match reports against. The field that matters most. */
  interests: string[];
  tier?: string;
  expectedMonthlyDownloads?: number;
  registeredAtIso: string;
  status: ApplicationStatus;
  /** The forms, once the applicant has started them. */
  onboarding?: OnboardingProgress;
  /** When the applicant sent it for review — what puts it in the queue. */
  submittedAtIso?: string;
  decidedAtIso?: string;
  decidedByEmail?: string;
  /**
   * The organisation the platform created for this application.
   *
   * Absent until `POST /platform/organisations` has run for it — and absent
   * permanently on everything approved before that endpoint existed, which is
   * why provisioning is a separate, repeatable step rather than something
   * folded into the approval. An approved row with no id here is a newsroom
   * that has been told yes and cannot use its console.
   */
  organisationId?: string;
  /** When the organisation was actually created on the platform. */
  provisionedAtIso?: string;
  /**
   * Why it was rejected.
   *
   * Required on a rejection: an applicant told only "declined" applies again
   * with the same problem, and nobody involved learns anything.
   */
  decisionNote?: string;
}

/**
 * Read the whole file.
 *
 * A missing file is an empty queue — the ordinary state before anyone has
 * registered. Unreadable content is not: that is a real fault, and swallowing
 * it would silently empty the queue, which is the exact failure this module
 * exists to end. It throws instead, and the page renders an outage.
 */
async function readAll(): Promise<HeldApplication[]> {
  let raw: string;
  try {
    raw = await readFile(storePath(), 'utf8');
  } catch (cause) {
    if ((cause as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw cause;
  }

  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error(`Applications store at ${storePath()} is not a list.`);
  }
  return parsed as HeldApplication[];
}

/**
 * Replace the whole file, via a temporary file and a rename.
 *
 * Writing in place would leave a half-written file if the process died
 * mid-write, and a half-written file throws above — losing every application at
 * once. A rename is atomic on both platforms this runs on.
 */
async function writeAll(rows: HeldApplication[]): Promise<void> {
  const target = storePath();
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = `${target}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(rows, null, 2)}\n`, 'utf8');
  await rename(temporary, target);
}

export async function heldApplications(): Promise<HeldApplication[]> {
  const rows = await readAll();
  // Oldest first: a queue is worked from the front, and the platform console
  // reads row zero to say how long the front of the queue has waited.
  return rows.sort((a, b) => a.registeredAtIso.localeCompare(b.registeredAtIso));
}

/**
 * Applications an operator has to decide on.
 *
 * Submitted only. A draft is somebody still typing, and putting those in the
 * queue means reviewing applications whose documents have not been attached
 * yet.
 */
export async function applicationsAwaitingDecision(): Promise<HeldApplication[]> {
  return (await heldApplications()).filter((row) => row.status === 'submitted');
}

/**
 * Applications an operator has already answered, most recently decided first.
 *
 * A decision that disappears is its own bug. Approving an organisation removed
 * it from the queue and put it nowhere: the operator was left asking "I
 * approved one — where is it?", with no way to confirm the decision registered,
 * no record of what they had chosen, and no sight of the fact that approving
 * does not by itself create the organisation. The work that approval creates is
 * manual, so the list of things approved *is* the to-do list.
 */
export async function decidedApplications(): Promise<HeldApplication[]> {
  return (await heldApplications())
    .filter((row) => row.status === 'approved' || row.status === 'rejected')
    .sort((a, b) => (b.decidedAtIso ?? '').localeCompare(a.decidedAtIso ?? ''));
}

/** The application belonging to one account, if they filed one. */
export async function applicationFor(email: string): Promise<HeldApplication | null> {
  const wanted = email.trim().toLowerCase();
  const rows = await heldApplications();
  return rows.find((row) => row.accountEmail === wanted) ?? null;
}

export interface RegisterApplicationInput {
  accountEmail: string;
  organisationName: string;
  sector: string;
  contactName: string;
  email: string;
  phone: string;
  interests: string[];
  tier?: string;
  expectedMonthlyDownloads?: number;
  registeredAtIso: string;
}

/**
 * Register an organisation, or update the registration already on file.
 *
 * Replacing rather than appending, because the alternative is a queue with
 * three rows for one newsroom that registered twice after losing a session —
 * and an operator cannot tell which of them to act on. Anything already
 * submitted or decided is left exactly as it is: re-registering must not
 * silently reopen a decision, nor wipe out onboarding forms already filled in.
 */
export async function registerApplication(
  input: RegisterApplicationInput,
): Promise<HeldApplication> {
  const accountEmail = input.accountEmail.trim().toLowerCase();
  const rows = await readAll();
  const existing = rows.find((row) => row.accountEmail === accountEmail);

  if (existing && existing.status !== 'draft') return existing;

  const record: HeldApplication = {
    id: existing?.id ?? `held_${randomUUID()}`,
    accountEmail,
    organisationName: input.organisationName,
    sector: input.sector,
    contactName: input.contactName,
    email: input.email,
    phone: input.phone,
    interests: input.interests,
    ...(input.tier ? { tier: input.tier } : {}),
    ...(input.expectedMonthlyDownloads !== undefined
      ? { expectedMonthlyDownloads: input.expectedMonthlyDownloads }
      : {}),
    // The first registration's time, so re-registering does not send a
    // newsroom that has waited a week back to the end of the queue.
    registeredAtIso: existing?.registeredAtIso ?? input.registeredAtIso,
    status: 'draft',
    // Forms already filled in survive. Losing four steps of typing because
    // somebody re-submitted the registration form would be its own bug.
    ...(existing?.onboarding ? { onboarding: existing.onboarding } : {}),
  };

  await writeAll([...rows.filter((row) => row.accountEmail !== accountEmail), record]);
  return record;
}

/**
 * Save onboarding progress.
 *
 * Called as the applicant works, so closing the tab loses nothing. This is what
 * the wizard had no equivalent of: four steps and five document slots held in
 * React state with no request behind any of it, discarded on navigation.
 *
 * Refuses once submitted. The applicant can no longer edit an application under
 * review — otherwise the evidence an operator is looking at can change beneath
 * them mid-decision.
 */
export async function saveOnboarding(
  accountEmail: string,
  progress: OnboardingProgress,
): Promise<HeldApplication | null> {
  return update(accountEmail, (row) =>
    row.status === 'draft' ? { ...row, onboarding: progress } : null,
  );
}

/**
 * Send the application for review. This is what puts it in front of an operator.
 *
 * Idempotent: submitting twice leaves the first submission time in place rather
 * than moving the application to the back of the queue.
 */
export async function submitApplication(
  accountEmail: string,
  atIso: string,
): Promise<HeldApplication | null> {
  return update(accountEmail, (row) => {
    if (row.status === 'submitted') return row;
    if (row.status !== 'draft') return null;
    return { ...row, status: 'submitted', submittedAtIso: atIso };
  });
}

/**
 * Applications that were approved but whose organisation was never created.
 *
 * The backlog this console built up while `POST /platform/organisations` did
 * not exist. Each one is a newsroom that was told yes, signs in successfully,
 * and finds an outage — the account is real, the approval is real, and there is
 * no organisation behind either. They are not a rare edge case: until that
 * endpoint landed, this was *every* approved application.
 */
export async function approvedAwaitingOrganisation(): Promise<HeldApplication[]> {
  return (await heldApplications()).filter(
    (row) => row.status === 'approved' && !row.organisationId,
  );
}

/** Record the organisation the platform created, so it is never created twice. */
export async function recordOrganisation(
  id: string,
  organisationId: string,
  atIso: string,
): Promise<HeldApplication | null> {
  const rows = await readAll();
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;

  rows[index] = { ...rows[index]!, organisationId, provisionedAtIso: atIso };
  await writeAll(rows);
  return rows[index]!;
}

/**
 * Record an operator's decision.
 *
 * Honest about its reach: this writes down what an operator decided. Creating
 * the organisation is a separate step — see `recordOrganisation` — because it
 * can fail on its own, has to be repeatable for everything approved before the
 * endpoint existed, and must not be able to lose a decision by failing after it.
 */
export async function decideApplication(
  id: string,
  decision: 'approved' | 'rejected',
  by: { email: string; atIso: string; note?: string },
): Promise<HeldApplication | null> {
  const rows = await readAll();
  const index = rows.findIndex((row) => row.id === id);
  if (index === -1) return null;
  // Only something actually awaiting a decision can be decided. Approving a
  // draft would approve an application whose documents are not attached yet.
  if (rows[index]!.status !== 'submitted') return null;

  rows[index] = {
    ...rows[index]!,
    status: decision,
    decidedAtIso: by.atIso,
    decidedByEmail: by.email,
    ...(by.note ? { decisionNote: by.note } : {}),
  };
  await writeAll(rows);
  return rows[index]!;
}

/** Read-modify-write one row by account, returning null if the change is refused. */
async function update(
  accountEmail: string,
  change: (row: HeldApplication) => HeldApplication | null,
): Promise<HeldApplication | null> {
  const wanted = accountEmail.trim().toLowerCase();
  const rows = await readAll();
  const index = rows.findIndex((row) => row.accountEmail === wanted);
  if (index === -1) return null;

  const next = change(rows[index]!);
  if (!next) return null;

  rows[index] = next;
  await writeAll(rows);
  return next;
}

/**
 * Everything held here, for handing to the backend once it can take it.
 *
 * The point of a stopgap is that leaving it is cheap. Whoever builds the
 * create-application endpoint can POST this array and delete the module.
 */
export async function migrationPayload(): Promise<HeldApplication[]> {
  return heldApplications();
}
