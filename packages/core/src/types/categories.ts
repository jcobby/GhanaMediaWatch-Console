import type { IncidentCategory } from './api';

/**
 * The report taxonomy, for issues of public interest in Ghana.
 *
 * Three constraints shaped this list, and they pull against each other:
 *
 *   1. A reporter picks one while standing in front of the thing, on a phone,
 *      often in a hurry. Anything they cannot place in about two seconds is
 *      worse than useless — it produces mislabelled reports, which route to
 *      the wrong organisation and get nobody paid.
 *
 *   2. A category earns its place by mapping to a *different recipient*. Road
 *      condition and road accident sound adjacent and go to entirely different
 *      bodies; splitting them is the whole point. Two labels that always route
 *      to the same desk should be one label.
 *
 *   3. It has to cover what actually gets filmed here. A generic international
 *      taxonomy has no room for galamsey or chieftaincy disputes, and both are
 *      among the most consequential things a Ghanaian eyewitness records.
 *
 * Groups exist so a picker can stay fast at this size: nobody scans 23 chips,
 * but everybody can pick one of six headings and then one of four.
 */

export type CategoryGroup =
  'emergency' | 'safety' | 'services' | 'governance' | 'environment' | 'other';

export interface CategoryMeta {
  group: CategoryGroup;
  /** What a reporter sees on the picker. */
  label: string;
  /** One line of disambiguation, shown where there is room for it. */
  hint: string;
  /** The single source of truth for this category's colour in both apps. */
  hue: string;
}

export const CATEGORY_GROUP_LABEL: Record<CategoryGroup, string> = {
  emergency: 'Emergency',
  safety: 'Crime & safety',
  services: 'Public services',
  governance: 'Governance',
  environment: 'Environment',
  other: 'Other',
};

export const CATEGORY_META: Record<IncidentCategory, CategoryMeta> = {
  // ── emergency ────────────────────────────────────────────────────────────
  fire: {
    group: 'emergency',
    label: 'Fire',
    hint: 'Buildings, markets, vehicles, bush',
    hue: '#C2410C',
  },
  accident: {
    group: 'emergency',
    label: 'Accident',
    hint: 'Collisions and injuries on the road',
    hue: '#B91C1C',
  },
  flood: {
    group: 'emergency',
    label: 'Flooding',
    hint: 'Water over roads, homes or drains',
    hue: '#0369A1',
  },
  weather: {
    group: 'emergency',
    label: 'Storm damage',
    hint: 'Wind, rain and roofing damage',
    hue: '#0284C7',
  },
  health: {
    group: 'emergency',
    label: 'Health',
    hint: 'Outbreaks, clinics, medical emergencies',
    hue: '#0E7490',
  },

  // ── crime and safety ─────────────────────────────────────────────────────
  crime: {
    group: 'safety',
    label: 'Crime',
    hint: 'Theft, assault, armed incidents',
    hue: '#9F1239',
  },
  disorder: {
    group: 'safety',
    label: 'Violence or disorder',
    hint: 'Fighting, rioting, mob action',
    hue: '#A21CAF',
  },
  protest: {
    group: 'safety',
    // Separated from disorder deliberately. A lawful demonstration is not
    // disorder, and filing it as such misrepresents the people in the footage.
    label: 'Protest or demonstration',
    hint: 'Organised, non-violent gatherings',
    hue: '#C026D3',
  },

  // ── public services ──────────────────────────────────────────────────────
  utility: {
    group: 'services',
    label: 'Electricity',
    hint: 'Outages, sparking lines, meters',
    hue: '#1D4ED8',
  },
  water: {
    group: 'services',
    label: 'Water supply',
    hint: 'Burst pipes, shortages, dirty supply',
    hue: '#0891B2',
  },
  sanitation: {
    group: 'services',
    label: 'Sanitation',
    hint: 'Refuse, choked drains, open sewage',
    hue: '#78716C',
  },
  road: {
    group: 'services',
    // Not the same as an accident, and not the same as infrastructure — a
    // pothole goes to the roads authority, a collapsed bridge does not.
    label: 'Road condition',
    hint: 'Potholes, missing covers, no lighting',
    hue: '#57534E',
  },
  transport: {
    group: 'services',
    label: 'Transport',
    hint: 'Stations, fares, unsafe vehicles',
    hue: '#B45309',
  },
  infrastructure: {
    group: 'services',
    label: 'Public infrastructure',
    hint: 'Bridges, buildings, drains, poles',
    hue: '#0F766E',
  },
  education: {
    group: 'services',
    label: 'Education',
    hint: 'School conditions, absence, exams',
    hue: '#4338CA',
  },

  // ── governance ───────────────────────────────────────────────────────────
  corruption: {
    group: 'governance',
    label: 'Corruption',
    hint: 'Bribery, extortion, misuse of office',
    hue: '#7C2D12',
  },
  election: {
    group: 'governance',
    label: 'Elections',
    hint: 'Polling, counting, campaign conduct',
    hue: '#6D28D9',
  },
  chieftaincy: {
    group: 'governance',
    label: 'Chieftaincy',
    hint: 'Succession and traditional authority',
    hue: '#9333EA',
  },
  land: {
    group: 'governance',
    label: 'Land dispute',
    hint: 'Encroachment, demolition, double sale',
    hue: '#A16207',
  },

  // ── environment ──────────────────────────────────────────────────────────
  galamsey: {
    group: 'environment',
    // Given its own category rather than filed under environment. It is among
    // the most reported issues in the country and goes to a different set of
    // bodies from litter or tree felling.
    label: 'Galamsey',
    hint: 'Illegal mining and polluted rivers',
    hue: '#854D0E',
  },
  environment: {
    group: 'environment',
    label: 'Environment',
    hint: 'Pollution, dumping, deforestation',
    hue: '#15803D',
  },
  wildlife: {
    group: 'environment',
    label: 'Wildlife',
    hint: 'Animals in danger or causing danger',
    hue: '#4D7C0F',
  },

  // ── other ────────────────────────────────────────────────────────────────
  other: {
    group: 'other',
    label: 'Something else',
    hint: 'Anything the list does not cover',
    hue: '#475569',
  },
};

/** Categories in one group, in declaration order. */
export function categoriesInGroup(group: CategoryGroup): IncidentCategory[] {
  return (Object.keys(CATEGORY_META) as IncidentCategory[]).filter(
    (c) => CATEGORY_META[c].group === group,
  );
}

/** Every group that has at least one category, in display order. */
export const CATEGORY_GROUPS: CategoryGroup[] = [
  'emergency',
  'safety',
  'services',
  'governance',
  'environment',
  'other',
];

/** This category's colour. The one place either app should ask. */
export function categoryHue(category: IncidentCategory): string {
  return CATEGORY_META[category]?.hue ?? CATEGORY_META.other.hue;
}

/** This category's display label. */
export function categoryLabel(category: IncidentCategory): string {
  return CATEGORY_META[category]?.label ?? CATEGORY_META.other.label;
}
