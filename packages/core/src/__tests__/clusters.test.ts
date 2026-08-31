import { bucketByTime, clusterPoints, hotspots, trend, type ClusterPoint } from '../logic/clusters';

const AT = '2026-06-01T10:00:00.000Z';

const point = (
  id: string,
  latitude: number,
  longitude: number,
  over: Partial<ClusterPoint> = {},
): ClusterPoint => ({
  id,
  location: { latitude, longitude },
  category: 'flood',
  label: null,
  atIso: AT,
  ...over,
});

describe('clustering', () => {
  it('returns nothing for no points', () => {
    expect(clusterPoints([])).toEqual([]);
  });

  it('keeps distant reports apart', () => {
    // Accra Central and Adenta are ~17km apart.
    const clusters = clusterPoints([point('a', 5.5563, -0.1969), point('b', 5.708, -0.168)]);
    expect(clusters).toHaveLength(2);
  });

  it('groups reports within the radius', () => {
    const clusters = clusterPoints([
      point('a', 5.5563, -0.1969),
      point('b', 5.557, -0.1975),
      point('c', 5.5558, -0.196),
    ]);
    expect(clusters).toHaveLength(1);
    expect(clusters[0]!.pointIds.sort()).toEqual(['a', 'b', 'c']);
  });

  it('honours a tighter radius', () => {
    const points = [point('a', 5.5563, -0.1969), point('b', 5.562, -0.1969)];
    // ~630m apart.
    expect(clusterPoints(points, 1_000)).toHaveLength(1);
    expect(clusterPoints(points, 300)).toHaveLength(2);
  });

  it('produces the same clusters whatever order points arrive in', () => {
    // A dashboard that reshuffles its own hotspots between refreshes cannot be
    // talked over.
    const a = point('a', 5.5563, -0.1969);
    const b = point('b', 5.557, -0.1975);
    const c = point('c', 5.708, -0.168);
    const first = clusterPoints([a, b, c]).map((x) => x.pointIds.join());
    const second = clusterPoints([c, b, a]).map((x) => x.pointIds.join());
    expect(first).toEqual(second);
  });

  it('measures the radius to the furthest member', () => {
    const clusters = clusterPoints([point('a', 5.5563, -0.1969), point('b', 5.56, -0.1969)]);
    expect(clusters[0]!.radiusM).toBeGreaterThan(100);
    expect(clusters[0]!.radiusM).toBeLessThan(400);
  });

  it('names the dominant category', () => {
    const clusters = clusterPoints([
      point('a', 5.5563, -0.1969, { category: 'flood' }),
      point('b', 5.5565, -0.197, { category: 'flood' }),
      point('c', 5.5567, -0.1971, { category: 'sanitation' }),
    ]);
    expect(clusters[0]!.dominantCategory).toBe('flood');
  });

  it('reports how mixed a cluster is', () => {
    const uniform = clusterPoints([
      point('a', 5.5563, -0.1969, { category: 'flood' }),
      point('b', 5.5565, -0.197, { category: 'flood' }),
    ]);
    expect(uniform[0]!.mixed).toBe(0);

    const mixed = clusterPoints([
      point('a', 5.5563, -0.1969, { category: 'flood' }),
      point('b', 5.5565, -0.197, { category: 'sanitation' }),
    ]);
    // Half of one, half of another.
    expect(mixed[0]!.mixed).toBeCloseTo(0.5, 5);
  });

  it('scores a lone report as unmixed rather than undefined', () => {
    expect(clusterPoints([point('a', 5.5563, -0.1969)])[0]!.mixed).toBe(0);
  });

  it('takes the commonest place name', () => {
    const clusters = clusterPoints([
      point('a', 5.5563, -0.1969, { label: 'Kaneshie' }),
      point('b', 5.5565, -0.197, { label: 'Kaneshie' }),
      point('c', 5.5567, -0.1971, { label: 'Kaneshie Market' }),
    ]);
    expect(clusters[0]!.label).toBe('Kaneshie');
  });

  it('carries the newest timestamp', () => {
    const clusters = clusterPoints([
      point('a', 5.5563, -0.1969, { atIso: '2026-06-01T09:00:00.000Z' }),
      point('b', 5.5565, -0.197, { atIso: '2026-06-01T15:00:00.000Z' }),
    ]);
    expect(clusters[0]!.newestAtIso).toBe('2026-06-01T15:00:00.000Z');
  });

  it('orders the largest cluster first', () => {
    const clusters = clusterPoints([
      point('a', 5.708, -0.168),
      point('b', 5.5563, -0.1969),
      point('c', 5.5565, -0.197),
      point('d', 5.5567, -0.1971),
    ]);
    expect(clusters[0]!.pointIds).toHaveLength(3);
  });
});

describe('hotspots', () => {
  it('ignores a single report', () => {
    // One incident is a report. It becomes a pattern when it repeats.
    const clusters = clusterPoints([point('a', 5.5563, -0.1969)]);
    expect(hotspots(clusters)).toEqual([]);
  });

  it('surfaces repeats', () => {
    const clusters = clusterPoints([point('a', 5.5563, -0.1969), point('b', 5.5565, -0.197)]);
    expect(hotspots(clusters)).toHaveLength(1);
  });

  it('breaks a size tie by recency', () => {
    const clusters = clusterPoints([
      point('a', 5.5563, -0.1969, { atIso: '2026-06-01T09:00:00.000Z' }),
      point('b', 5.5565, -0.197, { atIso: '2026-06-01T09:05:00.000Z' }),
      point('c', 5.708, -0.168, { atIso: '2026-06-02T09:00:00.000Z' }),
      point('d', 5.7082, -0.1682, { atIso: '2026-06-02T09:05:00.000Z' }),
    ]);
    const ranked = hotspots(clusters);
    expect(ranked).toHaveLength(2);
    expect(ranked[0]!.pointIds).toContain('c');
  });
});

describe('timeline buckets', () => {
  const from = '2026-06-01T00:00:00.000Z';
  const to = '2026-06-04T00:00:00.000Z';

  it('includes empty periods', () => {
    // A series that omits quiet days draws a straight line through them and
    // makes a lull look like steady activity.
    const buckets = bucketByTime(['2026-06-01T10:00:00.000Z'], 'day', from, to);
    expect(buckets).toHaveLength(4);
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 0, 0]);
  });

  it('counts into the right day', () => {
    const buckets = bucketByTime(
      ['2026-06-01T10:00:00.000Z', '2026-06-03T23:59:00.000Z', '2026-06-03T00:01:00.000Z'],
      'day',
      from,
      to,
    );
    expect(buckets.map((b) => b.count)).toEqual([1, 0, 2, 0]);
  });

  it('buckets by hour when asked', () => {
    const buckets = bucketByTime(
      ['2026-06-01T10:10:00.000Z', '2026-06-01T10:50:00.000Z'],
      'hour',
      '2026-06-01T10:00:00.000Z',
      '2026-06-01T12:00:00.000Z',
    );
    expect(buckets).toHaveLength(3);
    expect(buckets[0]!.count).toBe(2);
  });

  it('ignores timestamps outside the window', () => {
    const buckets = bucketByTime(['2026-05-01T10:00:00.000Z'], 'day', from, to);
    expect(buckets.every((b) => b.count === 0)).toBe(true);
  });

  it('ignores unparseable timestamps rather than throwing', () => {
    const buckets = bucketByTime(['nonsense', '2026-06-01T10:00:00.000Z'], 'day', from, to);
    expect(buckets[0]!.count).toBe(1);
  });

  it('returns nothing when the range is inverted', () => {
    expect(bucketByTime([], 'day', to, from)).toEqual([]);
  });
});

describe('trend', () => {
  const bucket = (count: number) => ({ startIso: AT, count });

  it('says nothing from too few points', () => {
    // Reporting a trend from two data points is how a dashboard starts lying.
    expect(trend([bucket(1), bucket(5)])).toBeNull();
  });

  it('detects a rise', () => {
    const t = trend([bucket(1), bucket(1), bucket(5), bucket(6)]);
    expect(t?.direction).toBe('up');
  });

  it('detects a fall', () => {
    const t = trend([bucket(8), bucket(7), bucket(1), bucket(1)]);
    expect(t?.direction).toBe('down');
  });

  it('calls a small change flat', () => {
    const t = trend([bucket(10), bucket(10), bucket(10), bucket(11)]);
    expect(t?.direction).toBe('flat');
  });

  it('handles a silent period followed by activity', () => {
    const t = trend([bucket(0), bucket(0), bucket(3), bucket(4)]);
    expect(t?.direction).toBe('up');
  });

  it('is flat when nothing happened at all', () => {
    const t = trend([bucket(0), bucket(0), bucket(0), bucket(0)]);
    expect(t).toEqual({ direction: 'flat', change: 0 });
  });
});
