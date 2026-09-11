import 'server-only';
import { platform } from './consoleApi';
import { ApiUnavailable } from './apiError';
import { recordOrganisation, type HeldApplication } from './applications';

/**
 * Turning an approved application into a real organisation.
 *
 * **The step that had no endpoint.** An organisation registers, fills in the
 * onboarding forms, and an admin approves it — and the product owner is
 * explicit that approval is the end of setup: the organisation is then visible
 * in the app, receives the reports routed to it, and can release them to the
 * public feed. Until `POST /platform/organisations` landed, none of that could
 * happen. Approving only flipped a status in a file this console keeps, so an
 * approved newsroom signed in to a perfectly good account, every `/org/*` read
 * answered 403, and the console had to explain that the fault was ours.
 *
 * **Idempotent, deliberately.** It runs on approval, and it runs again on
 * demand for the backlog approved before the endpoint existed. Two guards keep
 * a repeat from creating a second newsroom: the recorded id short-circuits it,
 * and a name already in `/platform/organisations` is adopted rather than
 * duplicated. A duplicate organisation would split one newsroom's reports,
 * licences and payouts across two accounts with no way to merge them.
 *
 * **The membership is not optional.** An organisation whose own operator is not
 * a member of it is indistinguishable, from their side of the screen, from the
 * bug this fixes.
 */

export type ProvisionOutcome =
  | { ok: true; organisationId: string; created: boolean; memberAdded: boolean }
  | { ok: false; error: string; status: number };

/**
 * The role the applicant gets in their own organisation.
 *
 * `owner`, from the API's `OrgRole` enum. They applied for it, they completed
 * the onboarding, and they are the person who will add everyone else — an
 * `admin` cannot hand out ownership, so anything less leaves a newsroom that
 * has to come back to us to add its own editor.
 */
const APPLICANT_ROLE = 'owner';

export async function provisionOrganisation(
  application: HeldApplication,
): Promise<ProvisionOutcome> {
  if (application.status !== 'approved') {
    return {
      ok: false,
      status: 409,
      error: 'Only an approved application can become an organisation.',
    };
  }

  // Already done. Saying so is not a failure — the operator may simply have
  // clicked twice, and re-running would be the one thing that must not happen.
  if (application.organisationId) {
    return {
      ok: true,
      organisationId: application.organisationId,
      created: false,
      memberAdded: false,
    };
  }

  let organisationId: string;
  let created = false;

  const existing = await findByName(application.organisationName);
  if (existing) {
    organisationId = existing;
  } else {
    try {
      const answer = await platform.createOrganisation<unknown>(
        {
          name: application.organisationName,
          sector: application.sector,
          ...(application.interests.length ? { interests: application.interests } : {}),
          ...(application.tier ? { tier: application.tier } : {}),
        },
        application.id,
      );

      const id = idFrom(answer) ?? (await findByName(application.organisationName));
      if (!id) {
        /*
         * Created, but we cannot say what. The endpoint publishes no response
         * schema, so this reads any unambiguous wrapper and then falls back to
         * finding it by name. Both failing means an organisation may now exist
         * that this console cannot record — which must be said plainly, because
         * a silent retry is what creates the duplicate.
         */
        return {
          ok: false,
          status: 502,
          error:
            'The organisation was created but the service did not say which. Check the organisations list before trying again — retrying could create a second one.',
        };
      }

      organisationId = id;
      created = true;
    } catch (cause) {
      return {
        ok: false,
        status: cause instanceof ApiUnavailable ? cause.status : 502,
        error:
          cause instanceof ApiUnavailable
            ? `The organisation could not be created: ${cause.message}`
            : 'The organisation could not be created.',
      };
    }
  }

  /*
   * Recorded before the member is added, and on purpose.
   *
   * If adding the member fails, the id is already written down — so the next
   * attempt adopts the existing organisation instead of creating another one.
   * Recording last would make every failed membership call cost a duplicate
   * newsroom.
   */
  await recordOrganisation(application.id, organisationId, new Date().toISOString());

  let memberAdded = false;
  try {
    await platform.addOrganisationMember(organisationId, {
      email: application.accountEmail,
      role: APPLICANT_ROLE,
    });
    memberAdded = true;
  } catch (cause) {
    /*
     * Already a member is success, not failure — this step is repeatable and
     * the second run should be quiet. Anything else has to be reported: the
     * organisation exists and its operator still cannot reach it.
     */
    const status = cause instanceof ApiUnavailable ? cause.status : 0;
    if (status !== 409) {
      return {
        ok: false,
        status: status >= 400 ? status : 502,
        error: `${application.organisationName} was created, but ${application.accountEmail} could not be added to it. They will still see an empty console.`,
      };
    }
  }

  return { ok: true, organisationId, created, memberAdded };
}

/**
 * An organisation the platform already holds under this name.
 *
 * The guard against creating a second one — on a retry, on a double-click, or
 * when a previous attempt created the organisation and then failed before the
 * id could be written down. Matched case-insensitively on the trimmed name,
 * which is all the console has: the application carries no platform id, because
 * before now there was no platform record to carry one from.
 */
async function findByName(name: string): Promise<string | null> {
  const wanted = name.trim().toLowerCase();
  if (!wanted) return null;

  try {
    const rows = await platform.organisations<Record<string, unknown>>();
    const match = rows.find((row) => {
      const rowName = typeof row.name === 'string' ? row.name : '';
      return rowName.trim().toLowerCase() === wanted;
    });
    return match ? idFrom(match) : null;
  } catch {
    /*
     * Cannot check, so cannot rule out a duplicate — but refusing to provision
     * because a *list* is unavailable would block the whole flow on a read.
     * The caller proceeds; the recorded id makes a duplicate a one-time risk
     * rather than a repeating one.
     */
    return null;
  }
}

/**
 * The organisation id out of whatever shape the server answered with.
 *
 * `POST /platform/organisations` documents a 201 and no response body schema,
 * so this reads the wrappers the rest of this API actually uses rather than
 * assuming one. Returns null instead of guessing — an id read out of the wrong
 * field would attach a newsroom's reports to something else entirely.
 */
function idFrom(answer: unknown): string | null {
  if (!answer || typeof answer !== 'object') return null;
  const record = answer as Record<string, unknown>;

  const direct = record.id ?? record.organisationId ?? record.businessId ?? record.orgId;
  if (typeof direct === 'string' && direct) return direct;

  for (const key of ['organisation', 'business', 'data', 'item']) {
    const nested = record[key];
    if (nested && typeof nested === 'object') {
      const id = idFrom(nested);
      if (id) return id;
    }
  }

  return null;
}
