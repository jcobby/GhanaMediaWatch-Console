import { NextResponse } from 'next/server';
import { DOCUMENT_REQUIREMENTS } from '@dawuro/core';
import { isLiveBackend, upstreamUrl } from '@/lib/api';
import { readSession } from '@/lib/session';

/**
 * An applicant's document, for the platform owner reviewing it.
 *
 * **This is what approval was missing.** An organisation attaches a certificate
 * of incorporation, a tax ID and an officer's identity document, and until the
 * upload endpoint landed the service held only their *names* — so a platform
 * owner granted access to citizens' footage on the strength of a filename. The
 * bytes are stored now, and this is how somebody looks at them.
 *
 * Streamed rather than buffered, and proxied rather than linked: the bearer
 * token lives in an httpOnly session and can only be attached server-side, so a
 * link straight to the service could never carry it. The same reason the media
 * proxy exists, for the same kind of file.
 *
 * Access is checked here. These are identity documents belonging to named
 * people, and an endpoint is reachable directly however the page is gated.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; documentType: string }> },
) {
  const session = await readSession();
  /*
   * Signed in as a platform owner, or nothing at all. No distinction between
   * "not signed in" and "not allowed": a 403 would confirm the application
   * exists to anybody who can send a request.
   */
  if (!session?.accessToken || session.accountType !== 'platform_owner' || !isLiveBackend) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const { id, documentType } = await context.params;
  if (!(documentType in DOCUMENT_REQUIREMENTS)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 });
  }

  const url = upstreamUrl(
    `/platform/applications/${encodeURIComponent(id)}/documents/${encodeURIComponent(documentType)}`,
  );

  let upstream: Response;
  try {
    upstream = await fetch(url, {
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
        // A dev tunnel answers an unrecognised client with an HTML interstitial.
        'X-Tunnel-Skip-AntiPhishing-Page': 'true',
      },
      cache: 'no-store',
    });
  } catch {
    return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
  }

  if (!upstream.ok || !upstream.body) {
    return NextResponse.json(
      { error: upstream.status === 404 ? 'Nothing is attached for that document.' : 'That file could not be read.' },
      { status: upstream.status === 403 ? 404 : upstream.status },
    );
  }

  const contentType = upstream.headers.get('Content-Type') ?? 'application/octet-stream';
  const length = upstream.headers.get('Content-Length');

  return new NextResponse(upstream.body, {
    headers: {
      'Content-Type': contentType,
      ...(length ? { 'Content-Length': length } : {}),
      /*
       * Shown in the browser rather than downloaded. A reviewer checks a
       * registration number against a certificate and moves on; making them find
       * the file in a downloads folder adds a step and leaves identity documents
       * scattered on their machine.
       */
      'Content-Disposition': `inline; filename="${documentType}"`,
      // Private, and never held by a shared cache: these are identity documents.
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

/* The bytes are somebody's identity document; nothing about this is cacheable. */
export const dynamic = 'force-dynamic';
