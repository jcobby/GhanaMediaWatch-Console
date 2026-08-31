import { NextResponse, type NextRequest } from 'next/server';
import { isAdminRole } from '@dawuro/core';
import { SESSION_COOKIE, homeFor, verifySessionToken } from '@/lib/token';

/**
 * Role gating, before any page renders.
 *
 * A client-side role check is a suggestion — the page has already been sent by
 * the time it runs. This rejects at the edge instead, so a business account
 * never receives platform console markup at all.
 *
 * Routes are gated by prefix rather than by route group, because Next.js route
 * groups are a filesystem convention and do not appear in the URL. The two must
 * be kept in step by hand; the test suite asserts they are.
 */

/** Reachable without a session. */
const PUBLIC_PATHS = [
  '/login',
  '/no-console',
  '/register',
  '/join',
  '/invite',
  // Anyone holding a clip must be able to check it without an account.
  '/verify',
  // The demo role switcher. Gated by DAWURO_DEMO_ROLES on the API route that
  // actually mints a session — the page itself reveals nothing.
  '/roles',
];

/** Prefixes only a platform operator may reach. */
const PLATFORM_PREFIXES = ['/platform'];

/**
 * The admin module.
 *
 * Gated on the module rather than the individual role: which of the nine
 * admin roles may reach a given page inside it is decided by capability, on
 * the page itself. Middleware runs on every request and should answer the
 * cheap question — is this person an administrator at all.
 */
const ADMIN_PREFIXES = ['/admin'];

/** Prefixes only the verification desk may reach. */
const EDITOR_PREFIXES = ['/editorial'];

/** Prefixes only a business account may reach. */
const BUSINESS_PREFIXES = [
  '/inbox',
  '/onboarding',
  '/map',
  '/published',
  '/surveys',
  '/team',
  '/account',
  '/assignments',
  '/affiliations',
  '/support',
  '/earnings',
  '/agent',
  '/invoices',
  '/checkout',
];

function matches(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = token ? await verifySessionToken(token) : null;

  // Signed in and heading for the login page — send them to their console.
  if (session && pathname === '/login') {
    return NextResponse.redirect(
      new URL(
        homeFor(session.accountType, session.onboardingComplete ?? true, session.role),
        request.url,
      ),
    );
  }

  if (matches(pathname, PUBLIC_PATHS)) return NextResponse.next();

  if (!session) {
    const url = new URL('/login', request.url);
    // Preserved so a deep link survives the detour through sign-in.
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Reporters have an account but no console. Say so plainly rather than
  // bouncing them around a login loop they cannot win.
  if (session.accountType === 'reporter') {
    return NextResponse.redirect(new URL('/no-console', request.url));
  }

  if (matches(pathname, ADMIN_PREFIXES) && !(session.role && isAdminRole(session.role))) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  if (matches(pathname, PLATFORM_PREFIXES) && session.accountType !== 'platform_owner') {
    return NextResponse.redirect(new URL(homeFor(session.accountType), request.url));
  }

  if (matches(pathname, EDITOR_PREFIXES) && session.accountType !== 'editor') {
    return NextResponse.redirect(new URL(homeFor(session.accountType), request.url));
  }

  if (matches(pathname, BUSINESS_PREFIXES) && session.accountType !== 'business') {
    return NextResponse.redirect(new URL(homeFor(session.accountType), request.url));
  }

  /*
   * An organisation part-way through onboarding is held there.
   *
   * Not a nag — the rest of the console genuinely does not work yet. Nothing is
   * routed to an unapproved organisation, so every other screen would be empty
   * and the product would look broken rather than incomplete.
   */
  if (
    session.accountType === 'business' &&
    session.onboardingComplete === false &&
    !pathname.startsWith('/onboarding')
  ) {
    return NextResponse.redirect(new URL('/onboarding', request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Everything except Next internals, the auth handlers, and static files.
  matcher: [
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
