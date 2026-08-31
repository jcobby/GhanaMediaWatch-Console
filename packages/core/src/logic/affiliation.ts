import type { Invite, InviteProblem, OrgAffiliation } from '../types/affiliation';

/**
 * Rules for invites and affiliations. Onboarding lives in ./onboarding.
 *
 * Pure, so the same answer comes out on the phone, in the console and in a
 * test. That matters most for `inviteProblem`: an invite that the server
 * accepts but the client calls expired — or worse, the reverse — is a security
 * bug wearing a UX bug's clothes.
 */

// ─── invites ───────────────────────────────────────────────────────────────

/**
 * Why this invite cannot be redeemed, or null if it can.
 *
 * Checked in order of permanence: revoked first because someone deliberately
 * withdrew it, then expired, then exhausted. A revoked invite that has also
 * expired should report the revocation — that is the fact the admin will be
 * asked about.
 */
export function inviteProblem(invite: Invite, nowIso: string): InviteProblem | null {
  if (invite.revokedAtIso) return 'revoked';

  const now = Date.parse(nowIso);
  const expires = Date.parse(invite.expiresAtIso);
  // An unparseable expiry is treated as expired rather than as valid forever.
  if (!Number.isFinite(expires) || now >= expires) return 'expired';

  if (invite.maxUses !== null && invite.usedCount >= invite.maxUses) return 'exhausted';

  return null;
}

export function isInviteUsable(invite: Invite, nowIso: string): boolean {
  return inviteProblem(invite, nowIso) === null;
}

/** Redemptions left, or null when the invite is unlimited. */
export function remainingUses(invite: Invite): number | null {
  if (invite.maxUses === null) return null;
  return Math.max(0, invite.maxUses - invite.usedCount);
}

// ─── organisation affiliations ─────────────────────────────────────────────

/** Active affiliations involving this organisation, in either direction. */
export function affiliationsOf(
  businessId: string,
  affiliations: OrgAffiliation[],
): OrgAffiliation[] {
  return affiliations.filter(
    (a) =>
      a.status === 'active' &&
      (a.parentBusinessId === businessId || a.affiliateBusinessId === businessId),
  );
}

/**
 * Organisations whose licensed reports this one may see.
 *
 * Only downward and only when sharing was agreed. An affiliate can never read
 * its parent's inbox by virtue of the relationship — the arrow points one way,
 * and inverting it would let a contractor read the agency that hired them.
 *
 * Not transitive either: if A shares with B and B with C, A does not thereby
 * see C. Each pair is its own agreement.
 */
export function visibleAffiliateIds(businessId: string, affiliations: OrgAffiliation[]): string[] {
  return affiliations
    .filter((a) => a.status === 'active' && a.sharesReports && a.parentBusinessId === businessId)
    .map((a) => a.affiliateBusinessId);
}

/**
 * Whether a new affiliation may be created.
 *
 * Rejects self-affiliation and any pair that already has a live relationship,
 * because two active links between the same organisations cannot both be the
 * agreement.
 */
export function canAffiliate(
  parentBusinessId: string,
  affiliateBusinessId: string,
  affiliations: OrgAffiliation[],
): boolean {
  if (parentBusinessId === affiliateBusinessId) return false;

  return !affiliations.some(
    (a) =>
      a.status !== 'ended' &&
      ((a.parentBusinessId === parentBusinessId && a.affiliateBusinessId === affiliateBusinessId) ||
        (a.parentBusinessId === affiliateBusinessId && a.affiliateBusinessId === parentBusinessId)),
  );
}
