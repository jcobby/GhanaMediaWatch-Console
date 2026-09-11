/**
 * A stub for Next's `server-only` marker.
 *
 * The real package is resolved by the bundler, not by Node, so any test that
 * imports a server module fails on it. Exporting nothing is the whole
 * behaviour: the package exists to make a *build* fail when server code is
 * imported from a client component, and there is no build here to fail.
 */
export {};
