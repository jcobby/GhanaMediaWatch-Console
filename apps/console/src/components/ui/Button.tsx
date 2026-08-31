'use client';

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  leading?: ReactNode;
  fullWidth?: boolean;
}

const VARIANT: Record<Variant, string> = {
  // The signature violet-to-blue gradient, identical to the phone's.
  primary:
    'bg-gradient-to-br from-accent to-accent-alt text-text-on-dark shadow-sm hover:brightness-110 active:brightness-95',
  secondary:
    'bg-canvas-soft text-text-primary border border-hairline/10 hover:bg-canvas-raise active:bg-canvas-raise',
  ghost: 'text-text-secondary hover:bg-canvas-raise hover:text-text-primary',
  danger: 'bg-danger text-text-on-dark hover:brightness-110 active:brightness-95',
};

const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 rounded-sm',
  md: 'h-9 px-4 text-sm gap-2 rounded-sm',
  lg: 'h-11 px-5 text-base gap-2 rounded-md',
};

/**
 * Console button.
 *
 * Disabled state is visually distinct rather than merely faded — an operator
 * scanning a dense toolbar needs to see at a glance which actions are live.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading,
    leading,
    fullWidth,
    className,
    children,
    disabled,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-45 disabled:shadow-none disabled:brightness-100',
        VARIANT[variant],
        SIZE[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden
          className="h-3.5 w-3.5 animate-spin rounded-pill border-2 border-current border-t-transparent"
        />
      ) : (
        leading
      )}
      {children}
    </button>
  );
});
