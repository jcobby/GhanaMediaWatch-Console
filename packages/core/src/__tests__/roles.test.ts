import {
  ADMIN_ROLES,
  MODULE_META,
  PLATFORM_ROLES,
  ROLE_META,
  SERVICE_ROLES,
  isAdminRole,
  isReadOnly,
  roleCan,
  rolesInModule,
  rolesWith,
  VISIBLE_MODULES,
  isModuleVisible,
  visibleRoles,
} from '../types/roles';
import { navigationFor, reachableHrefs } from '../logic/navigation';

describe('the registry is internally consistent', () => {
  test('the modules hold 9 and 11 roles', () => {
    // The counts are shown on the module tabs, so a mismatch is visible.
    expect(ADMIN_ROLES).toHaveLength(9);
    expect(SERVICE_ROLES).toHaveLength(11);
    expect(PLATFORM_ROLES).toHaveLength(20);
  });

  test('every role has an entry, and every entry a role', () => {
    expect(new Set(PLATFORM_ROLES).size).toBe(PLATFORM_ROLES.length);
    expect(Object.keys(ROLE_META).sort()).toEqual([...PLATFORM_ROLES].sort());
  });

  test('each role declares the module it is listed under', () => {
    for (const role of ADMIN_ROLES) expect(ROLE_META[role].module).toBe('admin');
    for (const role of SERVICE_ROLES) expect(ROLE_META[role].module).toBe('service');
  });

  test('rolesInModule agrees with the lists', () => {
    expect(rolesInModule('admin')).toEqual(ADMIN_ROLES);
    expect(rolesInModule('service')).toEqual(SERVICE_ROLES);
  });

  test('no role is left without a capability or a home', () => {
    for (const role of PLATFORM_ROLES) {
      const meta = ROLE_META[role];
      expect(meta.capabilities.length).toBeGreaterThan(0);
      expect(meta.home.startsWith('/')).toBe(true);
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.blurb.length).toBeGreaterThan(0);
    }
  });

  test('no role lists the same capability twice', () => {
    for (const role of PLATFORM_ROLES) {
      const caps = ROLE_META[role].capabilities;
      expect(new Set(caps).size).toBe(caps.length);
    }
  });

  test('admin roles are the cross-tenant ones', () => {
    expect(MODULE_META.admin.crossTenant).toBe(true);
    expect(MODULE_META.service.crossTenant).toBe(false);
    for (const role of PLATFORM_ROLES) {
      expect(isAdminRole(role)).toBe(ROLE_META[role].module === 'admin');
    }
  });
});

describe('the permission rules that matter', () => {
  test('only the super admin can create administrators', () => {
    expect(rolesWith('manage_admins')).toEqual(['super_admin']);
  });

  test('the auditor can read everything it needs and write nothing', () => {
    expect(roleCan('auditor', 'view_audit_log')).toBe(true);
    expect(roleCan('auditor', 'export_audit')).toBe(true);
    // The whole point of the role. If this ever passes, the audit is worthless.
    expect(isReadOnly('auditor')).toBe(true);
    expect(roleCan('auditor', 'override_routing')).toBe(false);
    expect(roleCan('auditor', 'run_payouts')).toBe(false);
    expect(roleCan('auditor', 'decide_verification')).toBe(false);
  });

  test('exactly two roles can change nothing', () => {
    // The auditor by design, and the analyst because reading patterns is the
    // whole job — the existing OrgRole model draws the same line, where an
    // analyst views and exports but cannot triage or dispatch. Any third role
    // appearing here is far more likely to be a missing capability than a
    // deliberate one, which is what this assertion is for.
    expect(PLATFORM_ROLES.filter(isReadOnly).sort()).toEqual(['analyst', 'auditor']);
  });

  test('only editorial roles decide verification', () => {
    expect(rolesWith('decide_verification').sort()).toEqual(
      ['editorial_lead', 'verification_editor'].sort(),
    );
    // Running the platform must not include deciding what is true.
    expect(roleCan('super_admin', 'decide_verification')).toBe(false);
    expect(roleCan('operations', 'decide_verification')).toBe(false);
  });

  test('money is held by finance and the super admin only', () => {
    expect(rolesWith('run_payouts').sort()).toEqual(['finance_officer', 'super_admin'].sort());
  });

  test('signing keys sit with system administration, not with operations', () => {
    expect(rolesWith('manage_keys').sort()).toEqual(['super_admin', 'system_admin'].sort());
    expect(roleCan('operations', 'manage_keys')).toBe(false);
  });

  test('a null role holds nothing', () => {
    expect(roleCan(null, 'view_inbox')).toBe(false);
  });
});

describe('navigation is derived, not listed', () => {
  test('every role reaches its own home', () => {
    for (const role of PLATFORM_ROLES) {
      if (ROLE_META[role].mobileOnly) continue;
      expect(reachableHrefs(role)).toContain(ROLE_META[role].home);
    }
  });

  test('no role gets an empty sidebar', () => {
    for (const role of PLATFORM_ROLES) {
      if (ROLE_META[role].mobileOnly) continue;
      expect(navigationFor(role).length).toBeGreaterThan(0);
    }
  });

  test('the reporter has no console at all', () => {
    expect(ROLE_META.reporter.mobileOnly).toBe(true);
    expect(navigationFor('reporter')).toEqual([]);
  });

  test('home is never duplicated under a section', () => {
    for (const role of PLATFORM_ROLES) {
      const hrefs = navigationFor(role).flatMap((s) => s.items.map((i) => i.href));
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });

  test('a role only ever sees what it can do', () => {
    // The dispatcher must not be offered payouts or screening.
    const dispatcher = reachableHrefs('dispatcher');
    expect(dispatcher).not.toContain('/admin/payouts');
    expect(dispatcher).not.toContain('/admin/compliance');
    expect(dispatcher).toContain('/inbox');

    // And finance must not be offered the editorial queue.
    expect(reachableHrefs('finance_officer')).not.toContain('/editorial');
  });

  test('two roles in the same module still get different sidebars', () => {
    // If these ever match, the registry has stopped distinguishing the jobs.
    expect(reachableHrefs('auditor')).not.toEqual(reachableHrefs('finance_officer'));
    expect(reachableHrefs('analyst')).not.toEqual(reachableHrefs('dispatcher'));
  });
});

describe('module visibility', () => {
  test('only the admin module is offered at sign-in for now', () => {
    expect(VISIBLE_MODULES).toEqual(['admin']);
  });

  test('hidden means hidden, not deleted', () => {
    // The service module's roles must survive being taken off the sign-in
    // screen — their dashboards, navigation and seeded accounts all still
    // exist, and restoring the module must not require rebuilding them.
    expect(SERVICE_ROLES).toHaveLength(11);
    expect(PLATFORM_ROLES).toHaveLength(20);
    for (const role of SERVICE_ROLES) {
      expect(ROLE_META[role]).toBeDefined();
      expect(ROLE_META[role].capabilities.length).toBeGreaterThan(0);
    }
  });

  test('visibleRoles is exactly the admin nine', () => {
    expect(visibleRoles()).toEqual(ADMIN_ROLES);
    expect(visibleRoles()).toHaveLength(9);
  });

  test('isModuleVisible agrees with the list', () => {
    expect(isModuleVisible('admin')).toBe(true);
    expect(isModuleVisible('service')).toBe(false);
  });

  test('restoring the module would need no other change', () => {
    // Every service role still resolves a home and a sidebar. If this ever
    // fails, the module rotted while it was hidden — which is the whole risk
    // of hiding something rather than removing it.
    for (const role of SERVICE_ROLES) {
      if (ROLE_META[role].mobileOnly) continue;
      expect(navigationFor(role).length).toBeGreaterThan(0);
    }
  });
});
