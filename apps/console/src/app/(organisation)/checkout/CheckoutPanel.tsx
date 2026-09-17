'use client';

import { useState } from 'react';
import { Building2, CreditCard, Lock, Smartphone } from 'lucide-react';
import { formatCedis } from '@dawuro/core';
import { PayDirectLogo, PoweredByPayDirect } from '@/components/Brand';
import { Button } from '@/components/ui';

/**
 * Handing the payer to PayDirect.
 *
 * This used to be a simulated checkout: it collected a card number, expiry and
 * security code — or a wallet or bank account — waited two seconds and printed
 * "Payment received" with a made-up reference. Nothing was sent and nothing was
 * paid, and a form asking for card details that go nowhere is the shape of a
 * phishing page.
 *
 * Now it asks the service for PayDirect's checkout for this invoice and sends
 * the browser there. The payer chooses mobile money, card or bank on PayDirect's
 * own page.
 */
export function CheckoutPanel({
  invoiceId,
  amountPesewas,
}: {
  invoiceId: string;
  amountPesewas: number;
}) {
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const pay = async () => {
    setBusy(true);
    setFailure(null);
    try {
      const res = await fetch(`/api/org/invoices/${encodeURIComponent(invoiceId)}/checkout`, {
        method: 'POST',
      });
      const raw = await res.text();
      let answer: { checkoutUrl?: string; error?: string } | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as { checkoutUrl?: string; error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok || !answer?.checkoutUrl) {
        setFailure(answer?.error ?? `The payment page could not be opened (${res.status}). Nothing was charged.`);
        setBusy(false);
        return;
      }
      // A full navigation: the payer leaves the console for PayDirect.
      window.location.assign(answer.checkoutUrl);
    } catch {
      setFailure('The console could not reach its own server. Nothing was charged.');
      setBusy(false);
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border border-hairline/12 bg-canvas-soft">
      <div className="flex items-center justify-between gap-3 border-b border-hairline/[0.07] px-5 py-3.5">
        <PayDirectLogo className="h-6 w-auto" />
        <span className="flex items-center gap-1.5 text-2xs text-text-faint">
          <Lock className="h-3 w-3" strokeWidth={2.5} />
          Secure checkout
        </span>
      </div>

      <div className="space-y-5 p-5">
        <div>
          <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">
            On the next page, pay with
          </p>
          {/* Mobile money leads: it is how most of Ghana pays. */}
          <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Channel icon={<Smartphone className="h-4 w-4" />} label="Mobile money" hint="MTN, Telecel, AirtelTigo" />
            <Channel icon={<CreditCard className="h-4 w-4" />} label="Card" hint="Visa, Mastercard" />
            <Channel icon={<Building2 className="h-4 w-4" />} label="Bank account" hint="Direct transfer" />
          </ul>
        </div>

        {failure ? (
          <p role="alert" className="rounded-sm border border-danger/25 bg-danger-wash px-3 py-2 text-xs text-danger">
            {failure}
          </p>
        ) : null}

        <div className="space-y-2">
          <Button size="lg" fullWidth loading={busy} onClick={() => void pay()}>
            Pay {formatCedis(amountPesewas)} on PayDirect
          </Button>
          <p className="text-center text-2xs text-text-muted">
            You come back here once the payment is done.
          </p>
          <div className="flex justify-center pt-1">
            <PoweredByPayDirect />
          </div>
        </div>
      </div>
    </div>
  );
}

function Channel({ icon, label, hint }: { icon: React.ReactNode; label: string; hint: string }) {
  return (
    <li className="rounded-md border border-hairline/12 px-3 py-3">
      <span className="text-text-muted">{icon}</span>
      <span className="mt-1.5 block text-xs font-medium text-text-primary">{label}</span>
      <span className="mt-0.5 block text-2xs text-text-faint">{hint}</span>
    </li>
  );
}
