'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowRight, Check, ShieldCheck } from 'lucide-react';
import {
  INCIDENT_CATEGORIES,
  CATEGORY_GROUPS,
  CATEGORY_GROUP_LABEL,
  CATEGORY_META,
  categoriesInGroup,
  type OrganisationSector,
  type IncidentCategory,
  type SubscriptionTier,
} from '@dawuro/core';
import { Button, Field, Panel } from '@/components/ui';
import { PlanPicker } from '@/components/PlanPicker';
import { cn } from '@/lib/cn';

const SECTORS: { value: OrganisationSector; label: string }[] = [
  { value: 'government', label: 'Government agency' },
  { value: 'media', label: 'Media house' },
  { value: 'utility', label: 'Utility provider' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'ngo', label: 'NGO' },
  { value: 'research', label: 'Research' },
  { value: 'other', label: 'Other' },
];

type Step = 'organisation' | 'interests' | 'plan';

const STEPS: { key: Step; label: string }[] = [
  { key: 'organisation', label: 'Organisation' },
  { key: 'interests', label: 'What you need' },
  { key: 'plan', label: 'Plan' },
];

/**
 * Registering an organisation.
 *
 * Three steps, ordered so the cheap questions come first: an officer sees what
 * they are signing up for before being asked for anything they have to go and
 * find.
 *
 * Interests come before the plan on purpose — choosing categories is what makes
 * the volume estimate on the pricing step mean anything, and it is the setting
 * that most determines whether the product is useful to them at all.
 *
 * The last step creates the account and drops them into onboarding. What is
 * asked here is what an organisation can answer from memory; onboarding is
 * where the evidence goes, so nothing collected here is asked again there.
 */
export function RegisterForm() {
  const [step, setStep] = useState<Step>('organisation');

  const [name, setName] = useState('');
  const [sector, setSector] = useState<OrganisationSector>('government');
  const [contactName, setContactName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  /*
   * A password, collected at registration.
   *
   * Without one there was no way back in: registration signed the applicant
   * straight into a session, and once it expired no credential existed that
   * could recreate it. It is also what the backend's account creation requires.
   */
  const [password, setPassword] = useState('');

  const [interests, setInterests] = useState<IncidentCategory[]>([]);
  const [expected, setExpected] = useState(20);
  const [tier, setTier] = useState<SubscriptionTier>('standard');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = interests.length === INCIDENT_CATEGORIES.length;

  /**
   * Select or clear everything.
   *
   * A toggle rather than a one-way "select all", because the button is most
   * useful to someone who wants nearly everything — and they need to drop the
   * two that do not apply straight afterwards. A control that only ever adds
   * strands them with no way back but twenty-three individual taps.
   */
  const toggleAll = () => {
    setInterests(allSelected ? [] : [...INCIDENT_CATEGORIES]);
  };

  /** The same, for one group — a utility wants public services and nothing else. */
  const toggleGroup = (group: (typeof CATEGORY_GROUPS)[number]) => {
    const inGroup = categoriesInGroup(group);
    const whole = inGroup.every((c) => interests.includes(c));
    setInterests((prev) =>
      whole ? prev.filter((c) => !inGroup.includes(c)) : [...new Set([...prev, ...inGroup])],
    );
  };

  const orgMissing: string[] = [];
  if (!name.trim()) orgMissing.push('the organisation name');
  if (!contactName.trim()) orgMissing.push('your name');
  if (!/.+@.+\..+/.test(email)) orgMissing.push('a valid work email');
  if (!phone.trim()) orgMissing.push('a phone number');
  // The server's own floor. Said here so it is not discovered on submit.
  if (password.length < 8) orgMissing.push('a password of at least 8 characters');

  const submit = async () => {
    setSubmitting(true);
    setError(null);

    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        password,
        organisationName: name.trim(),
        sector,
        contactName: contactName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        interests,
        tier,
        expectedMonthlyDownloads: expected,
      }),
    });

    const body = (await res.json()) as { error?: string; redirectTo?: string };

    if (!res.ok) {
      setError(body.error ?? 'Registration failed.');
      setSubmitting(false);
      return;
    }

    // A full navigation, so the new session cookie is carried on every request
    // from here rather than racing the router's cached payloads.
    window.location.assign(body.redirectTo ?? '/onboarding');
  };

  const index = STEPS.findIndex((s) => s.key === step);

  return (
    <div className="space-y-5">
      {/* Progress */}
      <ol className="flex items-center gap-2">
        {STEPS.map((s, i) => (
          <li key={s.key} className="flex flex-1 items-center gap-2">
            <span
              className={cn(
                'flex h-6 w-6 shrink-0 items-center justify-center rounded-pill text-2xs font-semibold',
                i < index
                  ? 'bg-success text-text-on-dark'
                  : i === index
                    ? 'bg-accent text-text-on-dark'
                    : 'bg-canvas-raise text-text-faint',
              )}
            >
              {i < index ? <Check className="h-3 w-3" strokeWidth={3} /> : i + 1}
            </span>
            <span
              className={cn(
                'hidden truncate text-xs sm:block',
                i === index ? 'font-medium text-text-primary' : 'text-text-faint',
              )}
            >
              {s.label}
            </span>
            {i < STEPS.length - 1 ? (
              <span className="h-px flex-1 bg-hairline/10" aria-hidden />
            ) : null}
          </li>
        ))}
      </ol>

      {step === 'organisation' ? (
        <Panel className="space-y-4 p-5 sm:p-6">
          <Field
            label="Organisation name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Accra Metropolitan Assembly"
            required
          />

          <div className="flex flex-col gap-1.5">
            <label htmlFor="sector" className="text-xs font-medium text-text-secondary">
              Sector
            </label>
            <select
              id="sector"
              value={sector}
              onChange={(e) => setSector(e.target.value as OrganisationSector)}
              className="h-10 w-full rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base"
            >
              {SECTORS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Your name"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              required
            />
            <Field
              label="Work email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@organisation.gov.gh"
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+233 20 000 0000"
              required
            />
            <Field
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
              required
            />
          </div>
          <p className="-mt-1 text-2xs text-text-faint">
            You will sign in with this email and password. Keep them — this is the only way back
            into the account.
          </p>

          <StepFooter
            missing={orgMissing}
            onNext={() => setStep('interests')}
            nextLabel="Continue"
          />
        </Panel>
      ) : null}

      {step === 'interests' ? (
        <Panel className="space-y-5 p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold">What should reach you?</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Reports in these categories are routed to your inbox automatically. You can change
                this at any time — it is the setting that decides whether the product is useful to
                you.
              </p>
            </div>

            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                type="button"
                onClick={toggleAll}
                className="whitespace-nowrap rounded-pill border border-hairline/12 px-3 py-1.5 text-xs font-medium text-text-secondary transition hover:border-accent/40 hover:text-accent"
              >
                {allSelected ? 'Clear all' : 'Select all'}
              </button>
              <span className="tabular text-2xs text-text-faint">
                {interests.length} of {INCIDENT_CATEGORIES.length}
              </span>
            </div>
          </div>

          <div className="space-y-4">
            {CATEGORY_GROUPS.map((group) => (
              <div key={group}>
                <div className="flex items-baseline gap-2">
                  <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-text-faint">
                    {CATEGORY_GROUP_LABEL[group]}
                  </p>
                  <button
                    type="button"
                    onClick={() => toggleGroup(group)}
                    className="text-2xs text-text-faint underline underline-offset-2 transition hover:text-accent"
                  >
                    {categoriesInGroup(group).every((c) => interests.includes(c)) ? 'none' : 'all'}
                  </button>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {categoriesInGroup(group).map((category) => {
                    const on = interests.includes(category);
                    return (
                      <button
                        key={category}
                        type="button"
                        title={CATEGORY_META[category].hint}
                        onClick={() =>
                          setInterests((prev) =>
                            prev.includes(category)
                              ? prev.filter((c) => c !== category)
                              : [...prev, category],
                          )
                        }
                        aria-pressed={on}
                        className={cn(
                          'flex items-center gap-1.5 rounded-pill border px-3 py-1.5 text-xs transition',
                          on
                            ? 'border-accent bg-accent-wash text-accent'
                            : 'border-hairline/12 text-text-muted hover:border-accent/30',
                        )}
                      >
                        <span
                          aria-hidden
                          className="h-1.5 w-1.5 rounded-pill"
                          style={{
                            backgroundColor: CATEGORY_META[category].hue,
                          }}
                        />
                        {CATEGORY_META[category].label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="expected" className="text-xs font-medium text-text-secondary">
              Roughly how many reports will you download a month?
            </label>
            <input
              id="expected"
              type="number"
              min={0}
              max={2000}
              value={expected}
              onChange={(e) => setExpected(Number(e.target.value) || 0)}
              className="tabular h-10 w-32 rounded-sm border border-hairline/15 bg-canvas-soft px-3 text-base"
            />
            <p className="text-xs text-text-faint">
              An estimate only. It is used to price the plans honestly on the next step.
            </p>
          </div>

          <StepFooter
            missing={interests.length === 0 ? ['at least one category'] : []}
            onBack={() => setStep('organisation')}
            onNext={() => setStep('plan')}
            nextLabel="Continue"
          />
        </Panel>
      ) : null}

      {step === 'plan' ? (
        <div className="space-y-4">
          <PlanPicker value={tier} onChange={setTier} expectedMonthlyDownloads={expected} />

          <Panel className="flex items-start gap-3 border-info/20 bg-info-wash/25 p-4">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
            <p className="text-xs leading-relaxed text-text-muted">
              Creating the account does not take payment. Next you complete onboarding —
              registration documents, an authorised officer and the areas you cover — and no footage
              reaches you until a platform operator has verified your organisation.
            </p>
          </Panel>

          {error ? (
            <p role="alert" className="rounded-sm bg-danger-wash px-3 py-2 text-xs text-danger">
              {error}
            </p>
          ) : null}

          <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Button variant="ghost" onClick={() => setStep('interests')} className="shrink-0">
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              size="lg"
              loading={submitting}
              onClick={() => void submit()}
              className="shrink-0"
            >
              Create account and continue <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * The bottom of a step.
 *
 * Says what is still missing beside the button rather than leaving a dead
 * control — someone who cannot continue should never have to guess whether they
 * missed a field or the form is broken.
 */
function StepFooter({
  missing,
  onBack,
  onNext,
  nextLabel,
}: {
  missing: string[];
  onBack?: () => void;
  onNext: () => void;
  nextLabel: string;
}) {
  const ready = missing.length === 0;

  return (
    <div className="flex flex-col-reverse items-stretch gap-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <Button variant="ghost" onClick={onBack} className="shrink-0">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </Button>
      ) : (
        <span />
      )}

      <div className="flex flex-col-reverse items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3">
        {!ready ? (
          <p className="text-2xs leading-relaxed text-text-muted sm:text-right">
            Still needed: {missing.join(', ')}.
          </p>
        ) : null}
        <Button disabled={!ready} onClick={onNext} className="shrink-0">
          {nextLabel} <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
