'use client';

import { useState } from 'react';
import { Building2, Check, CreditCard, Loader2, Lock, Smartphone } from 'lucide-react';
import { formatCedis } from '@dawuro/core';
import { PayDirectLogo, PoweredByPayDirect } from '@/components/Brand';
import { Button, Field } from '@/components/ui';
import { cn } from '@/lib/cn';

/**
 * The checkout.
 *
 * **Simulated.** No card number, wallet number or bank detail entered here
 * goes anywhere — there is no PayDirect integration behind it and no network
 * call is made. It exists so the flow can be walked through and argued about
 * before money is real.
 *
 * Three channels because Ghana pays three ways, and a checkout that assumes a
 * card excludes most of the country. Mobile money leads deliberately: it is
 * how the majority of transactions actually happen, and burying it under a
 * card form would tell people this product was designed somewhere else.
 */

type Channel = 'wallet' | 'card' | 'bank';

const CHANNELS: {
  id: Channel;
  label: string;
  hint: string;
  icon: typeof Smartphone;
}[] = [
  { id: 'wallet', label: 'Mobile money', hint: 'MTN, Telecel, AirtelTigo', icon: Smartphone },
  { id: 'card', label: 'Card', hint: 'Visa, Mastercard', icon: CreditCard },
  { id: 'bank', label: 'Bank account', hint: 'Direct transfer', icon: Building2 },
];

const WALLETS = [
  { id: 'mtn', label: 'MTN MoMo', hue: '#FFCC00' },
  { id: 'telecel', label: 'Telecel Cash', hue: '#E4002B' },
  { id: 'atmoney', label: 'AirtelTigo Money', hue: '#00539F' },
];

const BANKS = [
  'GCB Bank',
  'Ecobank Ghana',
  'Absa Bank Ghana',
  'Stanbic Bank Ghana',
  'Fidelity Bank Ghana',
  'CalBank',
];

export function CheckoutPanel({ amountPesewas }: { amountPesewas: number }) {
  const [channel, setChannel] = useState<Channel>('wallet');
  const [wallet, setWallet] = useState('mtn');
  const [phone, setPhone] = useState('');
  const [card, setCard] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [bank, setBank] = useState(BANKS[0]!);
  const [account, setAccount] = useState('');

  const [state, setState] = useState<'idle' | 'pending' | 'done'>('idle');

  /** What is still missing, so the button is never dead without saying why. */
  const missing: string[] = [];
  if (channel === 'wallet' && phone.replace(/\D/g, '').length < 9) missing.push('a wallet number');
  if (channel === 'card') {
    if (card.replace(/\D/g, '').length < 15) missing.push('a card number');
    if (!/^\d{2}\s*\/\s*\d{2}$/.test(expiry.trim())) missing.push('an expiry date');
    if (cvc.replace(/\D/g, '').length < 3) missing.push('the security code');
  }
  if (channel === 'bank' && account.replace(/\D/g, '').length < 8)
    missing.push('an account number');

  const pay = () => {
    setState('pending');
    // Simulates the round trip to the provider. Mobile money in particular is
    // never instant — the payer approves a prompt on their handset — so a
    // checkout that resolved immediately would set the wrong expectation.
    setTimeout(() => setState('done'), 2200);
  };

  if (state === 'done') {
    return (
      <div className="rounded-lg border border-hairline/12 bg-canvas-soft p-8 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-pill bg-success-wash">
          <Check className="h-7 w-7 text-success" strokeWidth={2.5} />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-text-primary">Payment received</h2>
        <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-text-muted">
          {formatCedis(amountPesewas)} paid by{' '}
          {channel === 'wallet'
            ? WALLETS.find((w) => w.id === wallet)?.label
            : channel === 'card'
              ? 'card'
              : bank}
          . A receipt is on its way to your account email.
        </p>
        <p className="mt-3 font-mono text-xs text-text-faint">PD-SIM-8F42-11C7</p>

        <div className="mt-5 flex items-center justify-center">
          <PoweredByPayDirect />
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg border border-hairline/12 bg-canvas-soft">
      {/* ── Provider ────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 border-b border-hairline/[0.07] px-5 py-3.5">
        <PayDirectLogo className="h-6 w-auto" />
        <span className="flex items-center gap-1.5 text-2xs text-text-faint">
          <Lock className="h-3 w-3" strokeWidth={2.5} />
          Secure checkout
        </span>
      </div>

      <div className="p-5">
        {/* ── Channel ───────────────────────────────────────────────────── */}
        <p className="text-2xs font-semibold uppercase tracking-wider text-text-faint">Pay with</p>
        <div role="tablist" aria-label="Payment channel" className="mt-2 grid grid-cols-3 gap-2">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            const on = channel === c.id;
            return (
              <button
                key={c.id}
                role="tab"
                aria-selected={on}
                onClick={() => setChannel(c.id)}
                className={cn(
                  'rounded-md border px-3 py-3 text-left transition',
                  on
                    ? 'border-accent bg-accent-wash/50'
                    : 'border-hairline/12 hover:border-accent/30',
                )}
              >
                <Icon
                  className={cn('h-4 w-4', on ? 'text-accent' : 'text-text-muted')}
                  strokeWidth={2}
                />
                <span
                  className={cn(
                    'mt-1.5 block text-xs font-medium',
                    on ? 'text-accent' : 'text-text-primary',
                  )}
                >
                  {c.label}
                </span>
                <span className="mt-0.5 block text-2xs text-text-faint">{c.hint}</span>
              </button>
            );
          })}
        </div>

        {/* ── Details ───────────────────────────────────────────────────── */}
        <div className="mt-5 space-y-4">
          {channel === 'wallet' ? (
            <>
              <div>
                <p className="mb-1.5 text-xs font-medium text-text-secondary">Network</p>
                <div className="grid grid-cols-3 gap-2">
                  {WALLETS.map((w) => (
                    <button
                      key={w.id}
                      onClick={() => setWallet(w.id)}
                      aria-pressed={wallet === w.id}
                      className={cn(
                        'flex items-center gap-2 rounded-sm border px-2.5 py-2 text-xs transition',
                        wallet === w.id
                          ? 'border-accent bg-accent-wash/40 font-medium text-accent'
                          : 'border-hairline/12 text-text-muted hover:border-accent/30',
                      )}
                    >
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-pill"
                        style={{ backgroundColor: w.hue }}
                      />
                      <span className="truncate">{w.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <Field
                label="Wallet number"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="024 000 0000"
                hint="You will approve a prompt on this handset."
              />
            </>
          ) : null}

          {channel === 'card' ? (
            <>
              <Field
                label="Card number"
                value={card}
                onChange={(e) => setCard(e.target.value)}
                placeholder="4242 4242 4242 4242"
                autoComplete="cc-number"
              />
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="Expiry"
                  value={expiry}
                  onChange={(e) => setExpiry(e.target.value)}
                  placeholder="09 / 28"
                  autoComplete="cc-exp"
                />
                <Field
                  label="Security code"
                  value={cvc}
                  onChange={(e) => setCvc(e.target.value)}
                  placeholder="123"
                  autoComplete="cc-csc"
                />
              </div>
            </>
          ) : null}

          {channel === 'bank' ? (
            <>
              <div className="flex flex-col gap-1.5">
                <label htmlFor="bank" className="text-xs font-medium text-text-secondary">
                  Bank
                </label>
                <select
                  id="bank"
                  value={bank}
                  onChange={(e) => setBank(e.target.value)}
                  className="h-10 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base"
                >
                  {BANKS.map((b) => (
                    <option key={b}>{b}</option>
                  ))}
                </select>
              </div>
              <Field
                label="Account number"
                value={account}
                onChange={(e) => setAccount(e.target.value)}
                placeholder="0123456789"
                hint="A transfer can take up to one working day to clear."
              />
            </>
          ) : null}
        </div>

        {/* ── Pay ───────────────────────────────────────────────────────── */}
        <div className="mt-6 space-y-2">
          {missing.length > 0 ? (
            <p className="text-2xs text-text-muted">Still needed: {missing.join(', ')}.</p>
          ) : null}

          <Button
            size="lg"
            fullWidth
            disabled={missing.length > 0 || state === 'pending'}
            onClick={pay}
          >
            {state === 'pending' ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {channel === 'wallet' ? 'Waiting for your approval…' : 'Processing…'}
              </>
            ) : (
              <>Pay {formatCedis(amountPesewas)}</>
            )}
          </Button>

          {state === 'pending' && channel === 'wallet' ? (
            <p className="text-center text-2xs text-text-muted">
              Check {phone || 'your handset'} and approve the prompt.
            </p>
          ) : null}

          <div className="flex justify-center pt-1">
            <PoweredByPayDirect />
          </div>
        </div>
      </div>
    </div>
  );
}
