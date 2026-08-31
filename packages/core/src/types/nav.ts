/**
 * Navigation as data.
 *
 * Icons are addressed by **name**, never by component. The console's layouts
 * are Server Components and its sidebar is a Client Component, and a component
 * function cannot cross that boundary — React serializes elements and plain
 * data, not code. Passing the component fails at runtime with an opaque digest
 * rather than at build time, which is a slow way to learn it.
 *
 * Names are strings, so they serialize, and this package stays free of any
 * dependency on a particular icon library.
 */

export type NavIconName =
  | 'inbox'
  | 'megaphone'
  | 'clipboard'
  | 'users'
  | 'building2'
  | 'building'
  | 'dashboard'
  | 'share'
  | 'badge'
  | 'banknote'
  | 'map'
  | 'verify'
  | 'history'
  | 'shield'
  | 'server'
  | 'activity'
  | 'chart'
  | 'send'
  | 'lifebuoy'
  | 'scale'
  | 'key'
  | 'flag';

export interface NavItem {
  label: string;
  href: string;
  icon: NavIconName;
  /** Shown on the right. Omitted rather than rendered as zero. */
  count?: number;
}

export interface NavSection {
  /** Null for the first, unlabelled group. */
  title: string | null;
  items: NavItem[];
}
