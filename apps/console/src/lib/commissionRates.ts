import 'server-only';
import {
  sanitiseCommissionRates,
  sanitiseOffer,
  type CommissionRates,
  type OrganisationOffer,
} from '@dawuro/core';
import { apiRequest } from './api';
import { ApiUnavailable } from './apiError';
import { org } from './consoleApi';

/**
 * Commission rates, where the service keeps them.
 *
 * **Stored since 16 September.** `GET /settings` returns `{feed, commissions}`
 * and `PUT /platform/settings` accepts both, so a rate set here reaches every
 * phone. `/org/commission-offer` exists too, with `GET` and `PUT`.
 *
 * The `stored` and `supported` flags stay. They are not scaffolding for a
 * missing endpoint — they are how this file refuses to tell an operator their
 * rates were saved on the strength of a request having been accepted. Every read
 * and write reports whether the service's own answer came back carrying them, so
 * a silently dropped block still reads as dropped.
 */

type Loose = Record<string, unknown>;
const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export interface PlatformRatesResult {
  rates: CommissionRates;
  /** Whether the service holds rates, or these are the built-in defaults. */
  stored: boolean;
}

/** What every phone is served. Throws when the service cannot be reached. */
export async function readPlatformRates(): Promise<PlatformRatesResult> {
  const body = await apiRequest<Loose | null>('/settings', {});
  const stored = isRecord(body?.commissions);
  return { rates: sanitiseCommissionRates(stored ? body!.commissions : null), stored };
}

/**
 * Save the platform's rates, clamped, and say whether the service kept them.
 *
 * The answer to the write is checked first; the settings endpoint is cached for
 * five minutes, so a re-read is only a fallback for a write that answers empty.
 */
export async function writePlatformRates(
  rates: CommissionRates,
  token: string,
): Promise<PlatformRatesResult> {
  const clean = sanitiseCommissionRates(rates);
  const answer = await apiRequest<Loose | null>('/platform/settings', {
    method: 'PUT',
    token,
    body: { commissions: clean },
  });
  if (isRecord(answer?.commissions)) {
    return { rates: sanitiseCommissionRates(answer!.commissions), stored: true };
  }
  const reread = await readPlatformRates().catch(() => null);
  return { rates: clean, stored: Boolean(reread?.stored) };
}

export interface OfferResult {
  offer: OrganisationOffer;
  /** False while the service has no endpoint for an organisation's offer. */
  supported: boolean;
}

const notThere = (cause: unknown) =>
  cause instanceof ApiUnavailable && (cause.status === 404 || cause.status === 405);

/** This organisation's offer. An endpoint that does not exist yet is not an outage. */
export async function readOrganisationOffer(rates: CommissionRates): Promise<OfferResult> {
  try {
    const body = await org.commissionOffer<unknown>();
    return { offer: sanitiseOffer(body, rates), supported: true };
  } catch (cause) {
    if (notThere(cause)) return { offer: { categoryPesewas: {} }, supported: false };
    throw cause;
  }
}

export async function writeOrganisationOffer(
  offer: OrganisationOffer,
  rates: CommissionRates,
): Promise<OfferResult> {
  const clean = sanitiseOffer(offer, rates);
  try {
    const answer = await org.saveCommissionOffer<unknown>(clean);
    return { offer: isRecord(answer) ? sanitiseOffer(answer, rates) : clean, supported: true };
  } catch (cause) {
    if (notThere(cause)) return { offer: clean, supported: false };
    throw cause;
  }
}
