import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({ baseDirectory: dirname(fileURLToPath(import.meta.url)) });

const config = [
  /*
   * Build output, whichever directory it lands in.
   *
   * `.next-probe` is an isolated dist used to run or build a second instance
   * beside a live dev server without corrupting it — see DAWURO_DIST_DIR in
   * next.config.ts. Leaving it unignored means one such run fills lint with
   * hundreds of errors from generated code.
   */
  { ignores: ['.next/**', '.next-*/**', 'node_modules/**', 'next-env.d.ts'] },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      // Unused variables are a real signal in a codebase this young — usually
      // a half-finished wiring job rather than deliberate dead code.
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];

export default config;
