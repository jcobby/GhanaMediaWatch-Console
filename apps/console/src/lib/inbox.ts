import 'server-only';
import type { OrganisationAccount, Incident } from '@dawuro/core';
import { org } from './consoleApi';

/**
 * What routing delivered to this organisation.
 *
 * The server decides. This used to run the shared matcher over seeded incidents
 * so the console could show a plausible inbox before the backend existed, and
 * that guarantee — "we only show what routing would have sent" — held only
 * against fixtures. Now `GET /org/inbox` is the answer, and the matcher in
 * `@dawuro/core` keeps its real job: computing the same commission the server
 * computes, so the two cannot disagree about money.
 *
 * Nothing here falls back. `organisationFor` in particular used to return
 * `ORGANISATIONS[1]` for an unknown id, which meant an operator whose account
 * could not be resolved was shown a different organisation's inbox, its plan
 * and its allowance, with nothing on screen saying so.
 */

export async function offeredTo(): Promise<Incident[]> {
  return org.inbox<Incident>();
}

/** The signed-in operator's own organisation, as the server describes it. */
export async function currentBusiness(): Promise<OrganisationAccount> {
  return org.current<OrganisationAccount>();
}
