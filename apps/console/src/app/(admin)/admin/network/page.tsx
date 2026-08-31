import { redirect } from 'next/navigation';
import { isAdminRole } from '@dawuro/core';
import { AdminDashboard } from '@/components/admin/dashboards';
import { requireSession } from '@/lib/session';

/**
 * The Dawuro admin's home.
 *
 * The dashboard is chosen by the signed-in role rather than by the path, so
 * landing here as a different admin shows that role's own view instead of a
 * page belonging to somebody else.
 */
export default async function Page() {
  const session = await requireSession();
  if (!session.role || !isAdminRole(session.role)) redirect('/');
  return <AdminDashboard role={session.role} />;
}
