import type { OrgRole } from '../logic/permissions';
import type { EmployeeDuty, MembershipStatus } from './org';

/**
 * How people and organisations attach to one another.
 *
 * Three different relationships live here and they are deliberately separate
 * types, because collapsing them is how access-control bugs get written:
 *
 *   - An **invite** is a claim someone can redeem once. It grants nothing by
 *     itself.
 *   - An **organisation affiliation** links two institutions. A district office
 *     of a national body, an agency acting for an insurer, a media partner.
 *   - A **reporter affiliation** is a member of the public saying who, if
 *     anyone, they film on behalf of.
 *
 * The last one is the one most easily got wrong. A reporter who says they work
 * for an institution is making a claim, not acquiring a permission — the
 * institution still has to confirm it, exactly as with staff.
 */

// ─── invites ───────────────────────────────────────────────────────────────

export type InviteKind =
  /** Staff of the organisation itself. */
  | 'employee'
  /** An individual acting for the organisation but not employed by it. */
  | 'agent'
  /** Another organisation, which registers in its own right. */
  | 'affiliate_org';

export interface Invite {
  /** The opaque part of the link. Never guessable, never reused. */
  token: string;
  businessId: string;
  kind: InviteKind;
  createdByEmployeeId: string;
  createdAtIso: string;
  expiresAtIso: string;
  /**
   * How many people may redeem it. Null means unlimited until it expires.
   *
   * A team link handed out at a meeting wants many uses; a link naming one
   * person wants exactly one. Both are legitimate, so the limit is a property
   * of the invite rather than a rule in code.
   */
  maxUses: number | null;
  usedCount: number;
  revokedAtIso: string | null;

  /**
   * What the invite pre-fills on acceptance.
   *
   * Never a permission grant on its own — these are defaults an admin chose in
   * advance, and the strictest role is the right default when they did not.
   */
  presetBranchId: string | null;
  presetRole: OrgRole;
  presetDuties: EmployeeDuty[];
  /** Shown to whoever opens the link, so they know it is genuine. */
  note: string | null;
}

/** Why an invite cannot be redeemed. */
export type InviteProblem = 'revoked' | 'expired' | 'exhausted';

// ─── organisation to organisation ──────────────────────────────────────────

export type AffiliationKind =
  /** A branch or arm that is legally part of the parent. */
  | 'subsidiary'
  /** Equals working together. */
  | 'partner'
  /** Acts on the parent's behalf — loss adjusters, contractors. */
  | 'agent';

export interface OrgAffiliation {
  id: string;
  /** The organisation that invited. */
  parentBusinessId: string;
  /** The organisation that accepted. */
  affiliateBusinessId: string;
  kind: AffiliationKind;
  /**
   * Whether reports licensed by the affiliate are visible to the parent.
   *
   * Off by default and stated explicitly, because it is the whole substance of
   * the relationship. A parent that can read its agent's inbox is a very
   * different arrangement from one that merely shares a logo, and nobody should
   * discover which one they agreed to after the fact.
   */
  sharesReports: boolean;
  status: 'pending' | 'active' | 'ended';
  createdAtIso: string;
  endedAtIso: string | null;
}

// ─── members of the public ─────────────────────────────────────────────────

/**
 * Who a reporter films on behalf of, if anyone.
 *
 * Everyone answers this, and "independent" is a real answer rather than an
 * absence — most reporters are independent, and making them pick it explicitly
 * is what stops an unset field being read as an unverified institutional claim.
 */
export interface ReporterAffiliation {
  reporterId: string;
  /** Null when independent. */
  businessId: string | null;
  /**
   * `independent` needs no confirmation. An institutional claim starts pending
   * and is worth nothing until that institution accepts it.
   */
  status: MembershipStatus | 'independent';
  statedRole: string | null;
  declaredAtIso: string;
}
