/**
 * Submission volume over the last fourteen days.
 *
 * An area shape rather than bars: the question this answers is "which way is
 * it going", not "what was Tuesday". The final point is marked because it is
 * the one people actually read.
 *
 * Pure SVG with no chart library — a fourteen-point trend does not justify a
 * dependency, and inline SVG inherits the page's colours for free.
 */
export function Sparkline({
  values,
  width = 220,
  height = 48,
  label,
}: {
  values: readonly number[];
  width?: number;
  height?: number;
  label: string;
}) {
  if (values.length < 2) return null;

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = width / (values.length - 1);

  // Padded vertically so the stroke is not clipped at the extremes.
  const pad = 3;
  const usable = height - pad * 2;
  const points = values.map((v, i) => {
    const x = i * stepX;
    const y = pad + usable - ((v - min) / span) * usable;
    return [x, y] as const;
  });

  const line = points
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L${width},${height} L0,${height} Z`;
  const last = points[points.length - 1]!;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className="overflow-visible"
    >
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgb(var(--color-accent))" stopOpacity="0.22" />
          <stop offset="100%" stopColor="rgb(var(--color-accent))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#spark-fill)" />
      <path
        d={line}
        fill="none"
        stroke="rgb(var(--color-accent))"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx={last[0]}
        cy={last[1]}
        r="3"
        fill="rgb(var(--color-accent))"
        stroke="rgb(var(--color-canvas-soft))"
        strokeWidth="1.5"
      />
    </svg>
  );
}
