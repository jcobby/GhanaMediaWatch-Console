import type { Config } from 'tailwindcss';

/**
 * Ported from the phone app's tailwind.config.js so the two products read as
 * one system. The token *names* are identical; what differs is density.
 *
 * A console is operated, not scrolled. Rows are shorter, type is smaller, and
 * there are hover and focus states the phone has no concept of — so the scale
 * below adds tighter steps rather than reusing the phone's touch-sized ones.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: {
          DEFAULT: 'rgb(var(--color-canvas) / <alpha-value>)',
          soft: 'rgb(var(--color-canvas-soft) / <alpha-value>)',
          raise: 'rgb(var(--color-canvas-raise) / <alpha-value>)',
        },
        glass: {
          DEFAULT: 'rgb(var(--color-glass) / <alpha-value>)',
          media: 'rgb(var(--color-glass-media) / <alpha-value>)',
        },
        hairline: {
          DEFAULT: 'rgb(var(--color-hairline) / <alpha-value>)',
          media: 'rgb(var(--color-hairline-media) / <alpha-value>)',
        },
        text: {
          primary: 'rgb(var(--color-text-primary) / <alpha-value>)',
          secondary: 'rgb(var(--color-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--color-text-muted) / <alpha-value>)',
          faint: 'rgb(var(--color-text-faint) / <alpha-value>)',
          'on-dark': 'rgb(var(--color-text-on-dark) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--color-accent) / <alpha-value>)',
          alt: 'rgb(var(--color-accent-alt) / <alpha-value>)',
          bright: 'rgb(var(--color-accent-bright) / <alpha-value>)',
          wash: 'rgb(var(--color-accent-wash) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--color-success) / <alpha-value>)',
          wash: 'rgb(var(--color-success-wash) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--color-warning) / <alpha-value>)',
          wash: 'rgb(var(--color-warning-wash) / <alpha-value>)',
        },
        danger: {
          DEFAULT: 'rgb(var(--color-danger) / <alpha-value>)',
          wash: 'rgb(var(--color-danger-wash) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--color-info) / <alpha-value>)',
          wash: 'rgb(var(--color-info-wash) / <alpha-value>)',
        },
        live: 'rgb(var(--color-live) / <alpha-value>)',
      },
      borderRadius: {
        xs: '6px',
        sm: '10px',
        md: '14px',
        lg: '18px',
        xl: '24px',
        '2xl': '32px',
        pill: '999px',
      },
      boxShadow: {
        sm: '0 1px 2px rgba(14,16,36,0.06), 0 2px 8px rgba(14,16,36,0.04)',
        md: '0 2px 4px rgba(14,16,36,0.06), 0 8px 24px rgba(14,16,36,0.08)',
        lg: '0 4px 8px rgba(14,16,36,0.08), 0 16px 40px rgba(14,16,36,0.12)',
        focus: '0 0 0 3px rgba(91,61,245,0.28)',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      fontSize: {
        // Console-density scale. Tighter than the phone's.
        '2xs': ['11px', { lineHeight: '15px', letterSpacing: '0.02em' }],
        xs: ['12px', { lineHeight: '17px' }],
        sm: ['13px', { lineHeight: '19px' }],
        base: ['14px', { lineHeight: '21px' }],
        lg: ['16px', { lineHeight: '24px' }],
        xl: ['20px', { lineHeight: '28px' }],
        '2xl': ['26px', { lineHeight: '33px', letterSpacing: '-0.01em' }],
        '3xl': ['34px', { lineHeight: '41px', letterSpacing: '-0.02em' }],
      },
    },
  },
  plugins: [],
};

export default config;
