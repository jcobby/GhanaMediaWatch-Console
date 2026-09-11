/**
 * Tests for the console app.
 *
 * Deliberately node-environment and CommonJS: what is worth testing here is
 * the wiring between the role registry and the filesystem — that every
 * destination a role can reach is a page that exists. Rendering React
 * components adds a jsdom dependency for very little, since the logic those
 * components read from already has 359 tests in @dawuro/core.
 */
/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      { tsconfig: { module: 'commonjs', jsx: 'react-jsx', esModuleInterop: true } },
    ],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@dawuro/core$': '<rootDir>/../../packages/core/src/index.ts',
    /*
     * `server-only` exists only inside Next's bundler graph, so importing a
     * module that declares it fails to resolve under Jest. Stubbed rather than
     * removed from the source: it is what stops a module holding applicants'
     * emails and phone numbers from ever being pulled into client JavaScript,
     * and dropping it to make a test run would trade a real protection for a
     * config line.
     */
    '^server-only$': '<rootDir>/src/__mocks__/server-only.ts',
  },
};
