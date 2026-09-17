/**
 * Platform administrators as `GET /platform/admins` describes them.
 *
 * **Two role vocabularies exist, and this is the service's.** The console's own
 * `PlatformRole` (super_admin, finance_officer, auditor…) decides which console
 * pages a session sees. The service grants six roles of its own, and those are
 * what an administrator is actually given when created here. Showing the
 * console's nine as choices would create administrators with a role the service
 * has never heard of.
 *
 * Pure, so the tests can feed it the schema.
 */

export const LIVE_ADMIN_ROLES = [
  'platform_owner',
  'editor',
  'finance',
  'compliance',
  'operations',
  'support',
] as const;

export type LiveAdminRole = (typeof LIVE_ADMIN_ROLES)[number];

/*
 * The service's own note: "finance/compliance/operations/support currently map
 * to editor privileges". Said on each of those roles, so nobody grants
 * "Support" believing it is narrower than an editor.
 */
const SAME_AS_EDITOR = 'On the service today this holds the same access as an editor.';

export const ADMIN_ROLE_COPY: Record<LiveAdminRole, { label: string; description: string }> = {
  platform_owner: {
    label: 'Platform owner',
    description:
      'Everything, including adding and removing administrators and releasing payouts. Keep this to very few people.',
  },
  editor: {
    label: 'Editor',
    description: 'Runs the verification desk and decides what is published to the public feed.',
  },
  finance: { label: 'Finance', description: `For payouts and billing. ${SAME_AS_EDITOR}` },
  compliance: {
    label: 'Compliance',
    description: `For takedowns and legal holds. ${SAME_AS_EDITOR}`,
  },
  operations: {
    label: 'Operations',
    description: `For routing and day-to-day running. ${SAME_AS_EDITOR}`,
  },
  support: {
    label: 'Support',
    description: `For helping reporters and organisations. ${SAME_AS_EDITOR}`,
  },
};

export interface LiveAdmin {
  id: string;
  email: string;
  displayName: string | null;
  /** Null for a role this console does not recognise — shown, never offered. */
  role: LiveAdminRole | null;
  roleRaw: string;
  suspended: boolean;
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLiveRole = (value: unknown): value is LiveAdminRole =>
  typeof value === 'string' && (LIVE_ADMIN_ROLES as readonly string[]).includes(value);

export function normaliseAdmin(raw: unknown): LiveAdmin | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !raw.id) return null;
  return {
    id: raw.id,
    email: typeof raw.email === 'string' ? raw.email : '',
    displayName: typeof raw.displayName === 'string' && raw.displayName ? raw.displayName : null,
    role: isLiveRole(raw.role) ? raw.role : null,
    roleRaw: typeof raw.role === 'string' ? raw.role : 'unknown',
    suspended: raw.suspended === true,
  };
}

export function normaliseAdmins(raw: unknown): { admins: LiveAdmin[]; roles: LiveAdminRole[] } {
  const items = Array.isArray(raw) ? raw : isRecord(raw) && Array.isArray(raw.items) ? raw.items : [];
  const offered = isRecord(raw) && Array.isArray(raw.roles) ? raw.roles.filter(isLiveRole) : [];

  return {
    admins: items.map(normaliseAdmin).filter((admin): admin is LiveAdmin => admin !== null),
    // The service's list when it sends one; otherwise the six it documents.
    roles: offered.length > 0 ? offered : [...LIVE_ADMIN_ROLES],
  };
}

/**
 * Why this administrator's access cannot be changed from this screen, or null.
 *
 * The service refuses both cases; saying so beside the control saves somebody
 * pressing it to find out.
 */
export function lockedReason(admin: LiveAdmin, all: LiveAdmin[], selfEmail: string): string | null {
  if (admin.email && admin.email.toLowerCase() === selfEmail.toLowerCase()) {
    return 'You cannot change your own access. Another platform owner has to.';
  }
  const activeOwners = all.filter((a) => a.role === 'platform_owner' && !a.suspended);
  if (admin.role === 'platform_owner' && !admin.suspended && activeOwners.length <= 1) {
    return 'The last platform owner cannot be removed, suspended or demoted — nobody could restore access.';
  }
  return null;
}
