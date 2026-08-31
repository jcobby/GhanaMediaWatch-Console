import { INCIDENT_CATEGORIES, type IncidentCategory } from '../types/api';
import {
  CATEGORY_GROUPS,
  CATEGORY_GROUP_LABEL,
  CATEGORY_META,
  categoriesInGroup,
  categoryHue,
  categoryLabel,
} from '../types/categories';
import { estimateCommission } from '../logic/commission';

describe('the taxonomy stays complete', () => {
  it('describes every category exactly once', () => {
    // The union and the metadata are declared separately, so nothing but a
    // test stops them drifting apart.
    for (const category of INCIDENT_CATEGORIES) {
      expect(CATEGORY_META[category]).toBeDefined();
    }
    expect(Object.keys(CATEGORY_META).sort()).toEqual([...INCIDENT_CATEGORIES].sort());
  });

  it('puts every category in a group that is displayed', () => {
    for (const category of INCIDENT_CATEGORIES) {
      expect(CATEGORY_GROUPS).toContain(CATEGORY_META[category].group);
    }
  });

  it('leaves no group empty', () => {
    // An empty heading is a picker section a reporter opens and finds nothing
    // in, which reads as a bug.
    for (const group of CATEGORY_GROUPS) {
      expect(categoriesInGroup(group).length).toBeGreaterThan(0);
    }
  });

  it('labels every group', () => {
    for (const group of CATEGORY_GROUPS) {
      expect(CATEGORY_GROUP_LABEL[group]).toBeTruthy();
    }
  });

  it('accounts for every category across the groups, with no duplicates', () => {
    const seen = CATEGORY_GROUPS.flatMap(categoriesInGroup);
    expect(seen.sort()).toEqual([...INCIDENT_CATEGORIES].sort());
    expect(new Set(seen).size).toBe(seen.length);
  });
});

describe('every category is usable', () => {
  it('gives each one a distinct colour', () => {
    // Two categories sharing a hue makes the feed's colour coding a lie.
    const hues = INCIDENT_CATEGORIES.map((c) => CATEGORY_META[c].hue.toLowerCase());
    expect(new Set(hues).size).toBe(hues.length);
  });

  it('uses well-formed hex colours', () => {
    for (const category of INCIDENT_CATEGORIES) {
      expect(CATEGORY_META[category].hue).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });

  it('gives each one a label and a hint', () => {
    for (const category of INCIDENT_CATEGORIES) {
      expect(CATEGORY_META[category].label.length).toBeGreaterThan(2);
      expect(CATEGORY_META[category].hint.length).toBeGreaterThan(8);
    }
  });

  it('names no two categories the same', () => {
    const labels = INCIDENT_CATEGORIES.map((c) => categoryLabel(c).toLowerCase());
    expect(new Set(labels).size).toBe(labels.length);
  });

  it('pays something for every category', () => {
    // A category worth nothing is a trap: a reporter files under it and earns
    // zero with no warning.
    for (const category of INCIDENT_CATEGORIES) {
      const { grossPesewas } = estimateCommission({
        category,
        destination: 'marketplace',
        mediaKind: 'video',
        locationConfidence: 'high',
      });
      expect(grossPesewas).toBeGreaterThan(0);
    }
  });
});

describe('lookups are safe', () => {
  it('falls back rather than returning undefined for an unknown category', () => {
    // Categories arrive from an API and may outrun this build.
    const unknown = 'not_a_category' as IncidentCategory;
    expect(categoryHue(unknown)).toBe(CATEGORY_META.other.hue);
    expect(categoryLabel(unknown)).toBe(CATEGORY_META.other.label);
  });
});

describe('the Ghanaian categories this platform exists for', () => {
  it('separates galamsey from general environment reporting', () => {
    // They route to different bodies, and galamsey is among the most reported
    // issues in the country.
    expect(CATEGORY_META.galamsey).toBeDefined();
    expect(CATEGORY_META.galamsey.group).toBe('environment');
    expect(CATEGORY_META.galamsey.hue).not.toBe(CATEGORY_META.environment.hue);
  });

  it('separates a lawful protest from violent disorder', () => {
    expect(CATEGORY_META.protest.group).toBe('safety');
    expect(CATEGORY_META.disorder.group).toBe('safety');
    expect(categoryLabel('protest')).not.toBe(categoryLabel('disorder'));
  });

  it('separates road condition from road accident', () => {
    // A pothole goes to the roads authority; a collision goes to emergency
    // services. Same street, different recipient.
    expect(CATEGORY_META.road.group).toBe('services');
    expect(CATEGORY_META.accident.group).toBe('emergency');
  });

  it('covers elections, which the Electoral Commission subscribes for', () => {
    expect(CATEGORY_META.election.group).toBe('governance');
  });
});
