import { redirect } from 'next/navigation';
import { isAdminRole } from '@dawuro/core';
import { AdminDashboard } from '@/components/admin/dashboards';
import { requireSession } from '@/lib/session';
import { Outage, load } from '@/components/ui';
import { loadAdminData } from '@/lib/consoleApi';

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

  /*
   * The dashboards read data now rather than importing it.
   *
   * Every one of the nine used to render seeded constants at module scope — an
   * auditor's ledger, a finance officer's balances, an operations queue — so
   * there was no fetch that could fail and therefore nothing that could ever
   * reveal the numbers were not real.
   */
  const result = await load(() => loadAdminData());
  if (!result.ok) return <Outage error={result.error} />;

  return <AdminDashboard role={session.role} data={result.data} />;
}
