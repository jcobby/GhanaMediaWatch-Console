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
