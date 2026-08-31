import { BUSINESSES, SAMPLE_INCIDENTS, autoRoute, type Incident } from '@dawuro/core';

/**
 * What routing would deliver to one organisation.
 *
 * Runs the real matcher rather than a hand-picked list, so the console cannot
 * show a report that routing would never have sent — the same guarantee the
 * phone app makes, from the same function.
 *
 * Replaced by a backend query when the platform endpoints exist; the shape it
 * returns is what the endpoint should return.
 */
export function offeredTo(businessId: string): Incident[] {
  return SAMPLE_INCIDENTS.filter((incident) => {
    const matches = autoRoute(
      {
        category: incident.category,
        destination: 'marketplace',
        requestedBusinessIds: [],
        location:
          incident.location.latitude !== null && incident.location.longitude !== null
            ? {
                latitude: incident.location.latitude,
                longitude: incident.location.longitude,
              }
            : null,
      },
      BUSINESSES,
    );
    return matches.some((m) => m.businessId === businessId);
  });
}

export function countOffered(businessId: string): number {
  return offeredTo(businessId).length;
}

export function businessFor(businessId: string | undefined) {
  return BUSINESSES.find((b) => b.id === businessId) ?? BUSINESSES[1]!;
}
