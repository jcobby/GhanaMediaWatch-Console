import {
  affiliationsOf,
  canAffiliate,
  inviteProblem,
  isInviteUsable,
  remainingUses,
  visibleAffiliateIds,
} from '../logic/affiliation';
import type { Invite, OrgAffiliation } from '../types/affiliation';

const NOW = '2026-06-01T12:00:00.000Z';
const LATER = '2026-06-08T12:00:00.000Z';
const EARLIER = '2026-05-25T12:00:00.000Z';

function invite(over: Partial<Invite> = {}): Invite {
  return {
    token: 'tok_abc',
    businessId: 'biz_1',
    kind: 'employee',
    createdByEmployeeId: 'emp_1',
    createdAtIso: EARLIER,
    expiresAtIso: LATER,
    maxUses: 5,
    usedCount: 0,
    revokedAtIso: null,
    presetBranchId: null,
    presetRole: 'viewer',
    presetDuties: [],
    note: null,
    ...over,
  };
}

describe('invites', () => {
  it('is usable while live, unspent and unrevoked', () => {
    expect(inviteProblem(invite(), NOW)).toBeNull();
    expect(isInviteUsable(invite(), NOW)).toBe(true);
  });

  it('rejects an expired invite', () => {
    expect(inviteProblem(invite({ expiresAtIso: EARLIER }), NOW)).toBe('expired');
  });

  it('treats the exact expiry moment as expired', () => {
    // Off-by-one here means a link works for one more request than intended.
    expect(inviteProblem(invite({ expiresAtIso: NOW }), NOW)).toBe('expired');
  });

  it('rejects a revoked invite', () => {
    expect(inviteProblem(invite({ revokedAtIso: EARLIER }), NOW)).toBe('revoked');
  });

  it('reports revocation ahead of expiry when both apply', () => {
    // Revocation is the deliberate act, and the fact an admin will be asked
    // about.
    const dead = invite({ revokedAtIso: EARLIER, expiresAtIso: EARLIER });
    expect(inviteProblem(dead, NOW)).toBe('revoked');
  });

  it('rejects an invite that has been fully redeemed', () => {
    expect(inviteProblem(invite({ maxUses: 3, usedCount: 3 }), NOW)).toBe('exhausted');
    expect(inviteProblem(invite({ maxUses: 3, usedCount: 9 }), NOW)).toBe('exhausted');
  });

  it('lets an unlimited invite be redeemed any number of times', () => {
    expect(inviteProblem(invite({ maxUses: null, usedCount: 500 }), NOW)).toBeNull();
    expect(remainingUses(invite({ maxUses: null }))).toBeNull();
  });

  it('treats an unparseable expiry as expired rather than eternal', () => {
    // Failing closed: a malformed date must never mean "valid forever".
    expect(inviteProblem(invite({ expiresAtIso: 'not-a-date' }), NOW)).toBe('expired');
  });

  it('counts remaining uses without going negative', () => {
    expect(remainingUses(invite({ maxUses: 5, usedCount: 2 }))).toBe(3);
    expect(remainingUses(invite({ maxUses: 5, usedCount: 8 }))).toBe(0);
  });

  it('defaults a preset to the least privileged role', () => {
    // An invite that pre-grants admin is a link that grants admin.
    expect(invite().presetRole).toBe('viewer');
  });
});

describe('organisation affiliations', () => {
  const link = (over: Partial<OrgAffiliation> = {}): OrgAffiliation => ({
    id: 'aff_1',
    parentBusinessId: 'biz_parent',
    affiliateBusinessId: 'biz_child',
    kind: 'agent',
    sharesReports: true,
    status: 'active',
    createdAtIso: EARLIER,
    endedAtIso: null,
    ...over,
  });

  it('finds affiliations from either side', () => {
    const all = [link()];
    expect(affiliationsOf('biz_parent', all)).toHaveLength(1);
    expect(affiliationsOf('biz_child', all)).toHaveLength(1);
  });

  it('ignores ended affiliations', () => {
    expect(affiliationsOf('biz_parent', [link({ status: 'ended' })])).toHaveLength(0);
    expect(affiliationsOf('biz_parent', [link({ status: 'pending' })])).toHaveLength(0);
  });

  it('shares reports downward only', () => {
    const all = [link()];
    expect(visibleAffiliateIds('biz_parent', all)).toEqual(['biz_child']);
    // The affiliate must never gain sight of the parent's inbox by virtue of
    // being affiliated to it.
    expect(visibleAffiliateIds('biz_child', all)).toEqual([]);
  });

  it('does not share reports when sharing was not agreed', () => {
    expect(visibleAffiliateIds('biz_parent', [link({ sharesReports: false })])).toEqual([]);
  });

  it('is not transitive', () => {
    // A shares with B, B shares with C. A must not thereby see C.
    const all = [
      link({ id: 'a', parentBusinessId: 'A', affiliateBusinessId: 'B' }),
      link({ id: 'b', parentBusinessId: 'B', affiliateBusinessId: 'C' }),
    ];
    expect(visibleAffiliateIds('A', all)).toEqual(['B']);
  });

  it('refuses to affiliate an organisation with itself', () => {
    expect(canAffiliate('biz_1', 'biz_1', [])).toBe(false);
  });

  it('refuses a second live link between the same pair, in either direction', () => {
    const all = [link()];
    expect(canAffiliate('biz_parent', 'biz_child', all)).toBe(false);
    expect(canAffiliate('biz_child', 'biz_parent', all)).toBe(false);
  });

  it('allows a new link once the previous one ended', () => {
    expect(canAffiliate('biz_parent', 'biz_child', [link({ status: 'ended' })])).toBe(true);
  });
});
