import type { NavSection } from '../types/nav';
import { ROLE_META, roleCan, type ConsoleCapability, type PlatformRole } from '../types/roles';

/**
 * What a role sees in the sidebar.
 *
 * Derived from capabilities rather than listed per role, so a permission and
 * the navigation that exposes it can never disagree. The failure this prevents
 * is specific and common: a role gains a capability, nobody updates its menu,
 * and the feature is live but unreachable — or worse, a role loses a capability
 * and keeps the link, so the only thing standing between them and the page is a
 * server check nobody remembered to write.
 */

interface Entry {
  label: string;
  href: string;
  icon: NavSection['items'][number]['icon'];
  /** Shown when the role holds this capability. */
  needs: ConsoleCapability;
  section: string | null;
}

const ENTRIES: Entry[] = [
  // ── platform administration ──────────────────────────────────────────────
  {
    label: 'Administrators',
    href: '/admin/administrators',
    icon: 'shield',
    needs: 'manage_admins',
    section: 'Platform',
  },
  {
    label: 'People',
    href: '/admin/people',
    icon: 'users',
    needs: 'manage_staff',
    section: 'Platform',
  },
  {
    label: 'Branches',
    href: '/admin/branches',
    icon: 'building',
    needs: 'manage_branches',
    section: 'Platform',
  },
  {
    label: 'System',
    href: '/admin/system',
    icon: 'server',
    needs: 'manage_integrations',
    section: 'Platform',
  },
  {
    label: 'Keys',
    href: '/admin/keys',
    icon: 'key',
    needs: 'manage_keys',
    section: 'Platform',
  },
  {
    label: 'Retention',
    href: '/admin/retention',
    icon: 'history',
    needs: 'manage_retention',
    section: 'Platform',
  },

  // ── oversight ────────────────────────────────────────────────────────────
  {
    label: 'Routing desk',
    href: '/admin/operations',
    icon: 'activity',
    needs: 'view_routing',
    section: 'Oversight',
  },
  {
    label: 'Service levels',
    href: '/admin/sla',
    icon: 'flag',
    needs: 'view_sla',
    section: 'Oversight',
  },
  {
    label: 'Institutions',
    href: '/admin/institutions',
    icon: 'building2',
    needs: 'approve_institutions',
    section: 'Oversight',
  },

  // ── network ──────────────────────────────────────────────────────────────
  {
    label: 'Partner network',
    href: '/admin/network',
    icon: 'share',
    needs: 'view_partner_network',
    section: 'Network',
  },

  // ── compliance ───────────────────────────────────────────────────────────
  {
    label: 'Screening',
    href: '/admin/compliance',
    icon: 'scale',
    needs: 'run_screening',
    section: 'Compliance',
  },
  {
    label: 'Takedowns',
    href: '/admin/takedowns',
    icon: 'flag',
    needs: 'handle_takedowns',
    section: 'Compliance',
  },
  {
    label: 'Audit log',
    href: '/admin/audit',
    icon: 'history',
    needs: 'view_audit_log',
    section: 'Compliance',
  },

  // ── money ────────────────────────────────────────────────────────────────
  {
    label: 'Subscriptions',
    href: '/admin/finance',
    icon: 'banknote',
    needs: 'manage_subscriptions',
    section: 'Money',
  },
  {
    label: 'Payouts',
    href: '/admin/payouts',
    icon: 'banknote',
    needs: 'run_payouts',
    section: 'Money',
  },
  {
    label: 'Invoices',
    href: '/invoices',
    icon: 'banknote',
    needs: 'view_invoices',
    section: 'Money',
  },

  // ── the service ──────────────────────────────────────────────────────────
  {
    label: 'Inbox',
    href: '/inbox',
    icon: 'inbox',
    needs: 'view_inbox',
    section: null,
  },
  {
    label: 'Assignments',
    href: '/assignments',
    icon: 'map',
    needs: 'record_response',
    section: null,
  },
  {
    label: 'Editorial',
    href: '/editorial',
    icon: 'verify',
    needs: 'view_editorial_queue',
    section: null,
  },
  {
    label: 'Desk',
    href: '/editorial/desk',
    icon: 'badge',
    needs: 'assign_editors',
    section: null,
  },
  {
    label: 'Surveys',
    href: '/surveys',
    icon: 'clipboard',
    needs: 'manage_surveys',
    section: null,
  },
  {
    label: 'Affiliations',
    href: '/affiliations',
    icon: 'share',
    needs: 'manage_affiliations',
    section: null,
  },
  {
    label: 'Submit',
    href: '/agent',
    icon: 'megaphone',
    needs: 'submit_reports',
    section: null,
  },
  {
    label: 'Earnings',
    href: '/earnings',
    icon: 'banknote',
    needs: 'view_earnings',
    section: null,
  },
  {
    label: 'Commission offers',
    href: '/commissions',
    icon: 'banknote',
    needs: 'view_earnings',
    section: null,
  },
  {
    label: 'Support',
    href: '/support',
    icon: 'lifebuoy',
    needs: 'handle_support',
    section: null,
  },
];

/**
 * The sidebar for a role.
 *
 * Home always comes first and is never capability-gated — a role with no other
 * entry still needs somewhere to be, and an empty sidebar reads as a broken
 * build rather than a narrow job.
 */
export function navigationFor(role: PlatformRole): NavSection[] {
  const meta = ROLE_META[role];
  if (meta.mobileOnly) return [];

  const sections = new Map<string | null, NavSection>();
  sections.set(null, {
    title: null,
    items: [{ label: 'Overview', href: meta.home, icon: 'dashboard' }],
  });

  for (const entry of ENTRIES) {
    if (!roleCan(role, entry.needs)) continue;
    // The home link is already present; a second copy under a section heading
    // reads as a duplicate rather than a shortcut.
    if (entry.href === meta.home) continue;

    const key = entry.section;
    const existing = sections.get(key);
    const item = { label: entry.label, href: entry.href, icon: entry.icon };

    if (existing) existing.items.push(item);
    else sections.set(key, { title: key, items: [item] });
  }

  return [...sections.values()].filter((s) => s.items.length > 0);
}

/** Every distinct destination a role can reach, for route gating. */
export function reachableHrefs(role: PlatformRole): string[] {
  return [...new Set(navigationFor(role).flatMap((s) => s.items.map((i) => i.href)))];
}

/**
 * The organisation shell's sidebar.
 *
 * Separate from `navigationFor` on purpose. That function answers "what may
 * this administrator reach", and every one of its entries is capability-gated
 * because an administrator always has a role. An organisation account may not: the
 * seeded institution logins carry a `businessId` and nothing else, and
 * `roleCan(undefined, …)` is false for everything — so a purely capability-
 * driven menu would leave such an account with an empty sidebar.
 *
 * Hence two lists. The first is what the shell itself is: the pages any account
 * inside an institution needs in order to use the product at all. The second is
 * the work a particular job does, which is exactly what capabilities describe.
 *
 * Seven pages were built, routable, middleware-permitted and linked from
 * nowhere — `/assignments`, `/affiliations`, `/agent`, `/earnings`, `/support`,
 * `/invoices` and, through it, `/checkout`. They were unreachable by clicking:
 * the only way in was to type the URL. This is the list that was missing.
 */
const ORGANISATION_BASE: {
  label: string;
  href: string;
  icon: NavSection['items'][number]['icon'];
  /**
   * Hidden from a role that lacks this — but only when there is a role at all.
   *
   * An entry with no `needs` is part of the shell for everybody inside the
   * organisation: `/published` is already-public material, and `/account` shows
   * the organisation its own plan and spend. Neither is another person's work.
   */
  needs?: ConsoleCapability;
}[] = [
  { label: 'Inbox', href: '/inbox', icon: 'inbox', needs: 'view_inbox' },
  // The map plots `org.inbox`. Same reports, same capability — see the page.
  { label: 'Map & trends', href: '/map', icon: 'map', needs: 'view_inbox' },
  { label: 'Published', href: '/published', icon: 'megaphone' },
  // Issues invites, so it decides who else may read citizens' footage.
  { label: 'Team', href: '/team', icon: 'users', needs: 'manage_staff' },
  { label: 'Account', href: '/account', icon: 'building2' },
];

/** Pages inside the organisation shell that a service role unlocks. */
const ORGANISATION_BY_CAPABILITY = new Set([
  '/assignments',
  '/surveys',
  '/affiliations',
  '/agent',
  '/earnings',
  '/commissions',
  '/support',
  '/invoices',
]);

/**
 * @param role The signed-in person's service role, when they have one.
 * @param inboxCount Reports waiting. Omitted rather than shown as zero.
 */
export interface OrganisationNavOptions {
  /** The signed-in person's service role, when they have one. */
  role?: PlatformRole;
  /** Reports waiting. Omitted rather than shown as zero. */
  inboxCount?: number;
  /**
   * Whether the organisation has finished onboarding.
   *
   * Defaults to true, because that is the state an account spends almost all
   * of its life in and a missing flag should not strand somebody on a setup
   * screen they have already completed.
   */
  onboardingComplete?: boolean;
}

/**
 * Onboarding is a phase, not a destination.
 *
 * While it is unfinished the middleware holds the account on `/onboarding` and
 * redirects every other organisation route back to it — so listing the rest of the
 * shell would offer six links that all lead to the same place. And once it is
 * finished there is nothing there to do, yet it sat in the sidebar for the life
 * of the account, reading as an outstanding task that could never be cleared.
 *
 * So it is the only item during, and absent after.
 */
export function organisationNavigation({
  role,
  inboxCount,
  onboardingComplete = true,
}: OrganisationNavOptions = {}): NavSection[] {
  if (!onboardingComplete) {
    return [
      { title: null, items: [{ label: 'Onboarding', href: '/onboarding', icon: 'clipboard' }] },
    ];
  }

  /*
   * The base list, minus anything this role may not do.
   *
   * `role ? … : true` is the whole subtlety, and it is why this cannot simply
   * mirror `navigationFor`. An organisation login may carry no role — the seeded
   * institution accounts have a `businessId` and nothing else — and
   * `roleCan(undefined, …)` is false for everything, so filtering such an
   * account against capabilities would empty its sidebar entirely. A role
   * *present and lacking* the capability is a real answer; a role *absent* is
   * not an answer at all, and must not be read as a denial.
   *
   * The pages enforce the same rule in the same shape. Before this, the base
   * five were offered to every role unconditionally while only some of them
   * checked anything on arrival — so the menu was advertising `/inbox` to an
   * Agent, who does not hold `view_inbox`, and the page then served it.
   */
  const items = ORGANISATION_BASE.filter(
    (item) => !item.needs || !role || roleCan(role, item.needs),
  ).map(({ label, href, icon }) =>
    href === '/inbox' && inboxCount
      ? { label, href, icon, count: inboxCount }
      : { label, href, icon },
  );

  if (role) {
    for (const entry of ENTRIES) {
      if (!ORGANISATION_BY_CAPABILITY.has(entry.href)) continue;
      if (!roleCan(role, entry.needs)) continue;
      // The base list wins: a page named in both keeps its position and its
      // count rather than appearing twice.
      if (items.some((i) => i.href === entry.href)) continue;
      items.push({ label: entry.label, href: entry.href, icon: entry.icon });
    }
  }

  return [{ title: null, items }];
}

/**
 * Every organisation-shell destination a role can reach across the account's life.
 *
 * Includes `/onboarding`, which no single moment shows alongside the rest — it
 * is the whole menu before completion and gone after. A reachability check asks
 * "can anyone ever get here", and the answer for onboarding is yes.
 */
export function organisationHrefs(role?: PlatformRole): string[] {
  const after = organisationNavigation({ role }).flatMap((s) => s.items.map((i) => i.href));
  return [...new Set(['/onboarding', ...after])];
}
