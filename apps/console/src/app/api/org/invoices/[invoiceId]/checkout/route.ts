import { NextResponse } from 'next/server';
import { ApiUnavailable } from '@/lib/apiError';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';

/**
 * Starting payment for one invoice.
 *
 * `POST /org/invoices/{id}/checkout` answers with PayDirect's hosted checkout
 * page, and the browser is sent there. The payer chooses mobile money, card or
 * bank on PayDirect's page, so no card or wallet number is ever typed into this
 * console — which the simulated checkout it replaces asked for, and sent nowhere.
 *
 * The return address is built here, from this request, and points back at the
 * checkout page for the same invoice, which re-reads its status from the service.
 */
export async function POST(request: Request, context: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await context.params;

  const session = await requireSession();
  if (session.accountType !== 'organisation') {
    return NextResponse.json({ error: 'This account has no invoices to pay.' }, { status: 403 });
  }

  const origin = request.headers.get('origin') ?? new URL(request.url).origin;
  const returnUrl = `${origin}/checkout?invoice=${encodeURIComponent(invoiceId)}&returned=1`;

  let checkoutUrl: string | undefined;
  try {
    const answer = await org.payInvoice<{ checkoutUrl?: string }>(invoiceId, returnUrl);
    checkoutUrl = answer?.checkoutUrl;
  } catch (cause) {
    /*
     * The service's own sentence: "this invoice is already paid" and "the
     * payment provider is unavailable" call for different next steps.
     */
    if (cause instanceof ApiUnavailable) {
      return NextResponse.json({ error: cause.message }, { status: cause.status || 502 });
    }
    return NextResponse.json({ error: 'The service could not be reached.' }, { status: 502 });
  }

  /*
   * Only a web address the browser should be sent to. The URL comes from our own
   * service, but this is where the payer leaves the console, and a `javascript:`
   * or malformed value must not become a navigation.
   */
  if (!checkoutUrl || !isSafeRedirect(checkoutUrl)) {
    return NextResponse.json(
      { error: 'The payment page could not be opened. Nothing was charged. Try again shortly.' },
      { status: 502 },
    );
  }

  return NextResponse.json({ checkoutUrl });
}

function isSafeRedirect(url: string): boolean {
  try {
    const { protocol } = new URL(url);
    if (protocol === 'https:') return true;
    // A local stub checkout during development.
    return protocol === 'http:' && process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}
