import type { NavIconName } from './nav';

/**
 * Who someone is on the Dawuro console.
 *
 * The platform splits into two modules, and the split is not cosmetic — it is
 * the difference between running the service and using it:
 *
 *   - **Admin module** runs the platform itself. These people work for Dawuro.
 *     They see across every institution, and most of them never look at an
 *     individual piece of footage.
 *   - **Service module** runs and uses the services. These people work for a
 *     subscribing institution, or report into one. They see their own
 *     organisation and nothing else.
 *
 * Keeping them apart matters because the two have opposite default answers to
 * "should this person see every organisation's data?" — yes for an auditor, an
 * emphatic no for a dispatcher. A single flat role list makes that a per-screen
 * decision, which is how a tenant boundary eventually leaks.
 *
 * This file is data, not behaviour. Everything derived from it — navigation,
 * gates, landing pages — is computed from these tables so a new role is one
 * entry rather than an edit in nine places.
 */

// ─── modules ───────────────────────────────────────────────────────────────

export type PlatformModule = 'admin' | 'service';

export interface ModuleMeta {
  id: PlatformModule;
  label: string;
  blurb: string;
  /** True when roles in this module see across every institution. */
  crossTenant: boolean;
}

export const MODULE_META: Record<PlatformModule, ModuleMeta> = {
  admin: {
    id: 'admin',
    label: 'Admin Module',
    blurb: 'Runs the platform itself.',
    crossTenant: true,
  },
  service: {
    id: 'service',
    label: 'Service Module',
    blurb: 'Runs and uses the services.',
    crossTenant: false,
  },
};

export const PLATFORM_MODULES: PlatformModule[] = ['admin', 'service'];

/**
 * The modules currently offered when signing in.
 *
 * The service module is built and working — its roles, dashboards, navigation
 * and seeded accounts all exist, and `/inbox`, `/editorial` and the rest are
 * reachable by anyone holding an account. It is simply not being shown yet.
 *
 * Hiding it here rather than deleting the entries, or commenting out two
 * separate lists, means bringing it back is one word and nothing else can
 * drift in the meantime — the tests below still cover all twenty roles.
 *
 * To restore it: add `'service'` back to this array.
 */
export const VISIBLE_MODULES: PlatformModule[] = ['admin'];

export function isModuleVisible(module: PlatformModule): boolean {
  return VISIBLE_MODULES.includes(module);
}

/** Roles offered at sign-in, as opposed to every role that exists. */
export function visibleRoles(): PlatformRole[] {
  return PLATFORM_ROLES.filter((role) => isModuleVisible(ROLE_META[role].module));
}

// ─── capabilities ──────────────────────────────────────────────────────────

/**
 * What a role may do, platform-wide.
 *
 * Distinct from `OrgCapability` in logic/permissions.ts, which governs what a
 * member may do *inside one organisation*. A dispatcher's `dispatch_units` is
 * scoped to their employer; an operations lead's `override_routing` is not.
 * Merging the two would mean a permission check could not tell you whose data
 * it was talking about.
 */
export type ConsoleCapability =
  // platform administration
  | 'manage_admins'
  | 'manage_staff'
  | 'manage_branches'
  | 'manage_integrations'
  | 'manage_keys'
  | 'manage_retention'
  // oversight
  | 'view_routing'
  | 'override_routing'
  | 'view_sla'
  | 'approve_institutions'
  // partner network
  | 'manage_partners'
  | 'view_partner_network'
  | 'manage_affiliations'
  // compliance
  | 'run_screening'
  | 'handle_takedowns'
  | 'view_audit_log'
  | 'export_audit'
  // money
  | 'manage_subscriptions'
  | 'run_payouts'
  | 'view_invoices'
  // the service itself
  | 'view_inbox'
  | 'assign_incidents'
  | 'record_response'
  | 'view_editorial_queue'
  | 'decide_verification'
  | 'assign_editors'
  | 'manage_surveys'
  | 'submit_reports'
  | 'view_earnings'
  | 'handle_support';

// ─── roles ─────────────────────────────────────────────────────────────────

export type AdminRole =
  | 'super_admin'
  | 'dawuro_admin'
  | 'system_admin'
  | 'hr_admin'
  | 'operations'
  | 'branch_manager'
  | 'compliance_officer'
  | 'finance_officer'
  | 'auditor';

export type ServiceRole =
  | 'institution_admin'
  | 'editorial_lead'
  | 'verification_editor'
  | 'dispatcher'
  | 'field_officer'
  | 'analyst'
  | 'survey_manager'
  | 'agent'
  | 'affiliate_partner'
  | 'reporter'
  | 'support_desk';

export type PlatformRole = AdminRole | ServiceRole;

export interface RoleMeta {
  id: PlatformRole;
  module: PlatformModule;
  label: string;
  /** One line, shown on the role card. What this person is for. */
  blurb: string;
  /** The sentence that explains the job to someone who has not done it. */
  description: string;
  capabilities: readonly ConsoleCapability[];
  /** Where they land after signing in. */
  home: string;
  /** Accent used for this role's chrome, so two roles never look identical. */
  hue: string;
  icon: NavIconName;
  /**
   * True when the role has no console at all.
   *
   * A reporter's product is the phone — camera, GPS gating and offline
   * capture. Signing them into a dashboard would be a worse experience than
   * telling them plainly that there is nothing here for them.
   */
  mobileOnly?: boolean;
}

export const ROLE_META: Record<PlatformRole, RoleMeta> = {
  // ─── admin module ────────────────────────────────────────────────────────
  super_admin: {
    id: 'super_admin',
    module: 'admin',
    label: 'Super Admin',
    blurb: 'Holds every permission, including who else may hold one.',
    description:
      'The only role that can create or remove other administrators. Everything else it can do, some other role can also do — which is the point: day-to-day work should never need this account.',
    capabilities: [
      'manage_admins',
      'manage_staff',
      'manage_branches',
      'manage_integrations',
      'manage_keys',
      'manage_retention',
      'view_routing',
      'override_routing',
      'view_sla',
      'approve_institutions',
      'manage_partners',
      'view_partner_network',
      'run_screening',
      'handle_takedowns',
      'view_audit_log',
      'manage_subscriptions',
      'run_payouts',
      'view_invoices',
    ],
    home: '/admin',
    hue: '#5B3DF5',
    icon: 'shield',
  },
  dawuro_admin: {
    id: 'dawuro_admin',
    module: 'admin',
    label: 'Dawuro Admin',
    blurb: 'Runs the connections between institutions on the platform.',
    description:
      'Owns the relationships that let one organisation see another’s reports — affiliations, invite links and the agent network. The one admin role whose job is the edges of the graph rather than the nodes.',
    capabilities: [
      'manage_partners',
      'view_partner_network',
      'manage_affiliations',
      'view_routing',
    ],
    home: '/admin/network',
    hue: '#0E7490',
    icon: 'share',
  },
  system_admin: {
    id: 'system_admin',
    module: 'admin',
    label: 'System Admin',
    blurb: 'Keeps the platform running: integrations, keys, retention.',
    description:
      'Infrastructure rather than editorial. Holds the signing keys that make capture integrity mean anything, and the retention rules that decide how long footage survives.',
    capabilities: ['manage_integrations', 'manage_keys', 'manage_retention', 'view_audit_log'],
    home: '/admin/system',
    hue: '#475569',
    icon: 'server',
  },
  hr_admin: {
    id: 'hr_admin',
    module: 'admin',
    label: 'HR / Administration',
    blurb: 'Staff records, duties and internal onboarding.',
    description:
      'Who works here, what they are qualified for, and which branch they belong to. Sets the specialisations and duties that routing later depends on.',
    capabilities: ['manage_staff', 'manage_branches', 'view_sla'],
    home: '/admin/people',
    hue: '#A25C00',
    icon: 'users',
  },
  operations: {
    id: 'operations',
    module: 'admin',
    label: 'Operations',
    blurb: 'The day-to-day desk: routing, SLA and escalations.',
    description:
      'Sits above automatic routing rather than in front of it — sees every submission and where it went, and steps in when nothing matched or an acknowledgement target is about to breach.',
    capabilities: [
      'view_routing',
      'override_routing',
      'view_sla',
      'approve_institutions',
      'view_partner_network',
    ],
    home: '/admin/operations',
    hue: '#0B7A4B',
    icon: 'activity',
  },
  branch_manager: {
    id: 'branch_manager',
    module: 'admin',
    label: 'Branch',
    blurb: 'One branch’s staff, jurisdiction and workload.',
    description:
      'The same view Operations has, narrowed to a single branch. Manages who is on duty and what their area of responsibility covers.',
    capabilities: ['manage_branches', 'view_sla', 'assign_incidents', 'manage_staff'],
    home: '/admin/branch',
    hue: '#1D4ED8',
    icon: 'building',
  },
  compliance_officer: {
    id: 'compliance_officer',
    module: 'admin',
    label: 'Compliance Officer',
    blurb: 'Screening, data protection and takedown requests.',
    description:
      'Runs sanctions and adverse-media screening on institutions before approval, and handles requests under Ghana’s Data Protection Act from people who appear in footage.',
    capabilities: [
      'run_screening',
      'handle_takedowns',
      'view_audit_log',
      'approve_institutions',
      'manage_retention',
    ],
    home: '/admin/compliance',
    hue: '#C1121F',
    icon: 'scale',
  },
  finance_officer: {
    id: 'finance_officer',
    module: 'admin',
    label: 'Finance Officer',
    blurb: 'Subscriptions, invoices and reporter payouts.',
    description:
      'Both sides of the money: what institutions are billed for downloads and seats, and what reporters are owed for licensed footage.',
    capabilities: ['manage_subscriptions', 'run_payouts', 'view_invoices', 'view_audit_log'],
    home: '/admin/finance',
    hue: '#65A30D',
    icon: 'banknote',
  },
  auditor: {
    id: 'auditor',
    module: 'admin',
    label: 'Auditor',
    blurb: 'Reads everything. Changes nothing.',
    description:
      'Deliberately has no write capability at all. An auditor who can alter the thing being audited is not an auditor, so this role sees the full ledger and can export it, and that is the whole of it.',
    capabilities: ['view_audit_log', 'export_audit', 'view_routing', 'view_sla', 'view_invoices'],
    home: '/admin/audit',
    hue: '#7A7F94',
    icon: 'history',
  },

  // ─── service module ──────────────────────────────────────────────────────
  institution_admin: {
    id: 'institution_admin',
    module: 'service',
    label: 'Institution Admin',
    blurb: 'Owns a subscribing organisation’s account.',
    description:
      'The officer who signed for the account. Manages members, branches, the subscription and what categories reach their inbox.',
    capabilities: [
      'view_inbox',
      'manage_surveys',
      'view_invoices',
      'manage_affiliations',
      'assign_incidents',
    ],
    home: '/inbox',
    hue: '#5B3DF5',
    icon: 'building2',
  },
  editorial_lead: {
    id: 'editorial_lead',
    module: 'service',
    label: 'Editorial Lead',
    blurb: 'Runs the verification desk and assigns editors.',
    description:
      'Owns the queue rather than individual decisions — who is working what, what is ageing, and which claims need a second pair of eyes before anything is called verified.',
    capabilities: ['view_editorial_queue', 'decide_verification', 'assign_editors', 'view_sla'],
    home: '/editorial',
    hue: '#0B7A4B',
    icon: 'badge',
  },
  verification_editor: {
    id: 'verification_editor',
    module: 'service',
    label: 'Verification Editor',
    blurb: 'Decides whether a claim is substantively true.',
    description:
      'Works the corroboration queue. The only role that can move a report into a verified state, and the reason assurance and verification are modelled apart.',
    capabilities: ['view_editorial_queue', 'decide_verification'],
    home: '/editorial',
    hue: '#1D4ED8',
    icon: 'verify',
  },
  dispatcher: {
    id: 'dispatcher',
    module: 'service',
    label: 'Dispatcher',
    blurb: 'Sends the right person to the incident.',
    description:
      'Reads the assignment scoring — specialisation, proximity, duty, capacity, language — and commits to a name. Sending a patrol is heavier than reading a chart, which is why this sits above analyst.',
    capabilities: ['view_inbox', 'assign_incidents', 'record_response', 'view_sla'],
    home: '/inbox',
    hue: '#A25C00',
    icon: 'send',
  },
  field_officer: {
    id: 'field_officer',
    module: 'service',
    label: 'Field Officer',
    blurb: 'Goes to the scene and records what happened.',
    description:
      'Receives assignments, acknowledges them against the clock, and files internal reports back to their own organisation — never anonymously, because an internal report is only actionable if you know who filed it.',
    capabilities: ['record_response', 'submit_reports', 'view_inbox'],
    home: '/assignments',
    hue: '#0E7490',
    icon: 'map',
  },
  analyst: {
    id: 'analyst',
    module: 'service',
    label: 'Analyst',
    blurb: 'Reads the patterns across an organisation’s reports.',
    description:
      'Trends, hotspots and exports. Sees a great deal of data and can act on none of it, which is the correct trade for a role whose job is to notice things.',
    capabilities: ['view_inbox'],
    home: '/inbox',
    hue: '#7A7F94',
    icon: 'chart',
  },
  survey_manager: {
    id: 'survey_manager',
    module: 'service',
    label: 'Survey Manager',
    blurb: 'Commissions structured answers from an area.',
    description:
      'Builds surveys, sets the reward and target, and watches the fill rate. Bounded by the plan’s concurrent-survey limit.',
    capabilities: ['manage_surveys', 'view_inbox'],
    home: '/surveys',
    hue: '#C026D3',
    icon: 'clipboard',
  },
  agent: {
    id: 'agent',
    module: 'service',
    label: 'Agent',
    blurb: 'An accredited reporter working under an institution.',
    description:
      'Files through an invite from an organisation rather than as a member of the public, so their footage carries institutional context and their earnings route through that relationship.',
    capabilities: ['submit_reports', 'view_earnings'],
    home: '/agent',
    hue: '#0B7A4B',
    icon: 'megaphone',
  },
  affiliate_partner: {
    id: 'affiliate_partner',
    module: 'service',
    label: 'Affiliate Partner',
    blurb: 'The contact at an affiliated organisation.',
    description:
      'Sees what the affiliation grants and nothing beyond it. Affiliation is directional and cannot form a cycle, so what reaches this person is always traceable to a decision someone made.',
    capabilities: ['manage_affiliations', 'view_inbox'],
    home: '/affiliations',
    hue: '#2563EB',
    icon: 'share',
  },
  reporter: {
    id: 'reporter',
    module: 'service',
    label: 'Reporter',
    blurb: 'Films incidents. Uses the phone, never this.',
    description:
      'The member of the public the whole platform exists to serve. Camera, GPS gating and offline capture are the product and none of them survive a browser, so this role has no console.',
    capabilities: ['submit_reports', 'view_earnings'],
    home: '/no-console',
    hue: '#647575',
    icon: 'megaphone',
    mobileOnly: true,
  },
  support_desk: {
    id: 'support_desk',
    module: 'service',
    label: 'Support Desk',
    blurb: 'Answers reporters and takes in disputes.',
    description:
      'The human on the other end of a query about a payout, a rejected report or a takedown. Can see a case and route it, but never decides it.',
    capabilities: ['handle_support', 'handle_takedowns', 'view_inbox'],
    home: '/support',
    hue: '#A25C00',
    icon: 'lifebuoy',
  },
};

// ─── derived ───────────────────────────────────────────────────────────────

export const ADMIN_ROLES: AdminRole[] = [
  'super_admin',
  'dawuro_admin',
  'system_admin',
  'hr_admin',
  'operations',
  'branch_manager',
  'compliance_officer',
  'finance_officer',
  'auditor',
];

export const SERVICE_ROLES: ServiceRole[] = [
  'institution_admin',
  'editorial_lead',
  'verification_editor',
  'dispatcher',
  'field_officer',
  'analyst',
  'survey_manager',
  'agent',
  'affiliate_partner',
  'reporter',
  'support_desk',
];

export const PLATFORM_ROLES: PlatformRole[] = [...ADMIN_ROLES, ...SERVICE_ROLES];

export function rolesInModule(module: PlatformModule): PlatformRole[] {
  return PLATFORM_ROLES.filter((role) => ROLE_META[role].module === module);
}

export function isAdminRole(role: PlatformRole): role is AdminRole {
  return ROLE_META[role].module === 'admin';
}

/** Whether a role holds a capability. */
export function roleCan(role: PlatformRole | null, capability: ConsoleCapability): boolean {
  if (!role) return false;
  return ROLE_META[role].capabilities.includes(capability);
}

/** Every role holding a capability — for "who can do this?" screens. */
export function rolesWith(capability: ConsoleCapability): PlatformRole[] {
  return PLATFORM_ROLES.filter((role) => roleCan(role, capability));
}

/**
 * Whether a role may write anything at all.
 *
 * Used to render read-only chrome rather than to enforce anything. An auditor
 * seeing greyed controls understands the account; an auditor seeing live
 * controls that fail on submit does not.
 */
const WRITE_CAPABILITIES: ReadonlySet<ConsoleCapability> = new Set([
  'manage_admins',
  'manage_staff',
  'manage_branches',
  'manage_integrations',
  'manage_keys',
  'manage_retention',
  'override_routing',
  'approve_institutions',
  'manage_partners',
  'manage_affiliations',
  'run_screening',
  'handle_takedowns',
  'manage_subscriptions',
  'run_payouts',
  'assign_incidents',
  'record_response',
  'decide_verification',
  'assign_editors',
  'manage_surveys',
  'submit_reports',
  'handle_support',
]);

export function isReadOnly(role: PlatformRole): boolean {
  return !ROLE_META[role].capabilities.some((c) => WRITE_CAPABILITIES.has(c));
}
