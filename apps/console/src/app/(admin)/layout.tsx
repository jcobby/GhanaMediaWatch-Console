import { redirect } from 'next/navigation';
import { ROLE_META, isAdminRole, navigationFor } from '@dawuro/core';
import { Sidebar, UserMenu } from '@/components/shell';
import { requireSession } from '@/lib/session';
import { RoleBadge } from '@/components/RoleBadge';

/**
 * The admin module shell.
 *
 * One layout for nine roles, because the difference between them is *what they
 * can reach*, not how the page is framed. The sidebar is computed from the
 * signed-in role's capabilities (`navigationFor`), so a super admin and an
 * auditor get visibly different consoles out of the same file, and neither can
 * be given a link to something they cannot do without first being given the
 * capability.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSession();
  const role = session.role;

  // Middleware gates the prefix, but a session carrying a service role that
  // reached here would render an admin frame around nothing.
  if (!role || !isAdminRole(role)) redirect('/');

  const meta = ROLE_META[role];
  const sections = navigationFor(role);

  return (
    <div className="flex h-screen overflow-hidden bg-canvas">
      <Sidebar
        sections={sections}
        accent={meta.hue}
        brand={
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.16em] text-text-faint">
              Admin Module
            </p>
            <p className="mt-0.5 text-sm font-semibold text-text-primary">Dawuro</p>
          </div>
        }
        footer={<UserMenu user={session} />}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <RoleBadge role={role} name={session.displayName} />
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
