import {
  Inbox,
  Megaphone,
  ClipboardList,
  Users,
  Building2,
  Building,
  LayoutDashboard,
  Share2,
  BadgeCheck,
  Banknote,
  ScanEye,
  History,
  Map,
  ShieldCheck,
  Server,
  Activity,
  ChartLine,
  Send,
  LifeBuoy,
  Scale,
  KeyRound,
  Flag,
  type LucideIcon,
} from 'lucide-react';
import type { NavIconName as CoreIconName } from '@dawuro/core';

/**
 * Navigation icons, addressed by name.
 *
 * The layouts are Server Components and the sidebar is a Client Component, and
 * a component *function* cannot cross that boundary — React can serialize
 * elements and plain data, not code. Passing `icon: Inbox` therefore fails at
 * runtime with an opaque digest rather than at build time, which is a slow way
 * to learn it.
 *
 * Names are plain strings, so they serialize. The client resolves the name to a
 * component, which also keeps stroke weight free to vary with the active state
 * — something pre-rendered elements could not do.
 */
export const NAV_ICONS = {
  inbox: Inbox,
  megaphone: Megaphone,
  clipboard: ClipboardList,
  users: Users,
  building2: Building2,
  building: Building,
  dashboard: LayoutDashboard,
  share: Share2,
  badge: BadgeCheck,
  banknote: Banknote,
  map: Map,
  verify: ScanEye,
  history: History,
  shield: ShieldCheck,
  server: Server,
  activity: Activity,
  chart: ChartLine,
  send: Send,
  lifebuoy: LifeBuoy,
  scale: Scale,
  key: KeyRound,
  flag: Flag,
  // Keyed by core's union rather than an inferred one, so a name added there
  // without an icon here is a compile error instead of a blank square.
} satisfies Record<CoreIconName, LucideIcon>;

export type NavIconName = CoreIconName;
