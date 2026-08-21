import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Frosted translucent fill instead of a solid one. */
  glass?: boolean;
  children: ReactNode;
}

/**
 * The console's surface primitive.
 *
 * `glass` uses a real backdrop-filter, which the phone app could only
 * approximate — so the design reads closer to its intent here than on the
 * device it was designed for.
 */
export function Panel({ glass, className, children, ...rest }: PanelProps) {
  return (
    <div
      className={cn(
        'rounded-md',
        glass ? 'glass-panel' : 'border border-hairline/[0.08] bg-canvas-soft',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
