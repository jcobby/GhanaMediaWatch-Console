'use client';

import { useMemo, useState } from 'react';
import { AlertCircle, ArrowRight, Check, Lock, Send } from 'lucide-react';
import {
  DOCUMENT_REQUIREMENTS,
  ONBOARDING_STEPS,
  documentSatisfied,
  missingDocuments,
  nextStepFor,
  stepState,
  submitProblem,
  type DocumentId,
  type OnboardingApplication,
  type OnboardingStepId,
  type UploadedDocument,
} from '@dawuro/core';
import { Button, Field, Panel } from '@/components/ui';
import { StepRail } from '@/components/StepRail';
import { DocumentSlot } from '@/components/DocumentSlot';

const SUBMIT_PROBLEM: Record<string, string> = {
  steps_outstanding: 'Some steps have not been sent yet.',
  documents_missing: 'Some required documents are still missing.',
  already_submitted: 'This application has already been submitted.',
};

/**
 * The institution's onboarding wizard.
 *
 * Registration establishes who is asking. This collects the evidence, one step
 * at a time, and each step is *sent for review* rather than ticked off —
 * completing a step never approves it.
 *
 * Steps can be done in any order. Real applicants gather documents at whatever
 * pace the documents arrive, and forcing a strict sequence means an application
 * stalls entirely because one certificate is with a lawyer.
 */
export function OnboardingWizard({
  initial,
  organisationName,
}: {
  initial: OnboardingApplication;
  organisationName: string;
}) {
  const [application, setApplication] = useState(initial);
  const [current, setCurrent] = useState<OnboardingStepId | 'review'>(
    nextStepFor(initial) ?? 'review',
  );

  // Step form values, held together so the review page can read them back.
  const [org, setOrg] = useState({
    legalName: organisationName,
    registrationNumber: '',
    tin: '',
  });
  const [officer, setOfficer] = useState({
    name: '',
    role: '',
    idNumber: '',
    phone: '',
  });
  const [coverage, setCoverage] = useState({
    address: '',
    city: '',
    areaLabel: '',
    radiusKm: '10',
  });

  const missing = useMemo(() => missingDocuments(application), [application]);
  const problem = submitProblem(application);

  /*
   * What each step is still waiting for, in the applicant's words.
   *
   * Returned as a list rather than a boolean so the button can say why it is
   * disabled. A dead control with no explanation is the fastest way to make
   * someone abandon a form — they cannot tell whether they missed a field or
   * the product is broken.
   *
   * The checks ask only whether something was answered. Length thresholds were
   * here and they were wrong: a three-character address is a real address, and
   * guessing at minimum lengths rejects valid data to no purpose.
   */
  const outstanding = (step: OnboardingStepId): string[] => {
    const need: string[] = [];
    if (step === 'organisation') {
      if (!org.legalName.trim()) need.push('the registered legal name');
      if (!org.registrationNumber.trim()) need.push('the registration number');
    }
    if (step === 'officer') {
      if (!officer.name.trim()) need.push('the officer’s full name');
      if (!officer.idNumber.trim()) need.push('their ID number');
    }
    if (step === 'coverage') {
      if (!coverage.address.trim()) need.push('the office address');
      if (!coverage.city.trim()) need.push('the city');
      if (!Number.isFinite(Number(coverage.radiusKm)) || Number(coverage.radiusKm) <= 0) {
        need.push('how far you operate');
      }
    }
    if (step === 'documents' && missing.length > 0) {
      need.push(missing.map((id) => DOCUMENT_REQUIREMENTS[id].label.toLowerCase()).join(', '));
    }
    return need;
  };

  const setStatus = (id: OnboardingStepId, status: 'in_progress' | 'submitted') =>
    setApplication((prev) => ({
      ...prev,
      steps: [
        ...prev.steps.filter((s) => s.id !== id),
        {
          id,
          status,
          rejectionReason: null,
          submittedAtIso: status === 'submitted' ? new Date().toISOString() : null,
          reviewedAtIso: null,
          reviewedBy: null,
        },
      ],
    }));

  const send = (id: OnboardingStepId) => {
    setStatus(id, 'submitted');
    const remaining = ONBOARDING_STEPS.find(
      (m) =>
        m.id !== id && !['submitted', 'approved'].includes(stepState(application, m.id).status),
    );
    setCurrent(remaining?.id ?? 'review');
  };

  const upload = (id: DocumentId, fileName: string) =>
    setApplication((prev) => ({
      ...prev,
      documents: [
        ...prev.documents.filter((d) => d.id !== id),
        {
          id,
          fileName,
          uploadedAtIso: new Date().toISOString(),
          reviewedOk: null,
        },
      ],
    }));

  const remove = (id: DocumentId) =>
    setApplication((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
    }));

  const docFor = (id: DocumentId): UploadedDocument | null =>
    application.documents.find((d) => d.id === id) ?? null;

  const slot = (id: DocumentId) => (
    <DocumentSlot
      key={id}
      id={id}
      uploaded={docFor(id)}
      satisfiedByAlternative={docFor(id) === null && documentSatisfied(application, id)}
      onUpload={(name) => upload(id, name)}
      onRemove={() => remove(id)}
    />
  );

  if (application.submittedAtIso) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-2xl px-7 py-10">
          <Panel className="p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-md bg-success-wash">
              <Check className="h-5 w-5 text-success" strokeWidth={2.5} />
            </div>
            <h2 className="mt-5 text-xl font-semibold">Application submitted</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-text-muted">
              Reference <span className="font-mono font-medium">{application.reference}</span>. The
              platform team reviews each step. If they need anything else, that step comes back to
              you with a reason rather than the whole application being declined.
            </p>
            <p className="mx-auto mt-4 flex max-w-md items-start gap-2 rounded-sm bg-canvas-raise px-3 py-2.5 text-left text-xs leading-relaxed text-text-muted">
              <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
              Your application is locked while it is being reviewed. Nothing reaches your inbox
              until it is approved.
            </p>
          </Panel>
        </div>
      </div>
    );
  }

  const rejected = stepState(application, current as OnboardingStepId).rejectionReason;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-7 lg:flex-row lg:gap-7">
        <aside className="w-full shrink-0 lg:w-56">
          <StepRail application={application} current={current} onSelect={setCurrent} />
        </aside>

        <div className="min-w-0 flex-1">
          {rejected ? (
            <Panel className="mb-3 flex items-start gap-2.5 border-danger/25 bg-danger-wash/35 p-3.5">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" strokeWidth={2.2} />
              <p className="text-xs leading-relaxed">
                <span className="font-medium">Sent back for a change.</span>{' '}
                <span className="text-text-muted">{rejected}</span>
              </p>
            </Panel>
          ) : null}

          {current === 'organisation' ? (
            <StepPanel
              id="organisation"
              onSend={() => send('organisation')}
              outstanding={outstanding('organisation')}
            >
              <Field
                label="Registered legal name"
                value={org.legalName}
                onChange={(e) => setOrg({ ...org, legalName: e.target.value })}
                hint="Exactly as it appears on the certificate."
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Registration number"
                  value={org.registrationNumber}
                  onChange={(e) => setOrg({ ...org, registrationNumber: e.target.value })}
                  placeholder="CS-123456789"
                  required
                />
                <Field
                  label="Tax identification number"
                  value={org.tin}
                  onChange={(e) => setOrg({ ...org, tin: e.target.value })}
                  placeholder="C0001234567"
                />
              </div>
              <div className="space-y-2 pt-1">{ONBOARDING_STEPS[0]!.documents.map(slot)}</div>
            </StepPanel>
          ) : null}

          {current === 'officer' ? (
            <StepPanel
              id="officer"
              onSend={() => send('officer')}
              outstanding={outstanding('officer')}
            >
              <p className="rounded-sm bg-canvas-raise px-3 py-2.5 text-xs leading-relaxed text-text-muted">
                {/* Said plainly because it is the obligation people miss. */}
                This person is accountable for what the organisation does with citizens&rsquo;
                footage. Their identity is checked, not just recorded.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Full name"
                  value={officer.name}
                  onChange={(e) => setOfficer({ ...officer, name: e.target.value })}
                  required
                />
                <Field
                  label="Position"
                  value={officer.role}
                  onChange={(e) => setOfficer({ ...officer, role: e.target.value })}
                  placeholder="Director of Operations"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Ghana Card / passport number"
                  value={officer.idNumber}
                  onChange={(e) => setOfficer({ ...officer, idNumber: e.target.value })}
                  required
                />
                <Field
                  label="Direct phone"
                  type="tel"
                  value={officer.phone}
                  onChange={(e) => setOfficer({ ...officer, phone: e.target.value })}
                  placeholder="+233 20 000 0000"
                />
              </div>
              <div className="space-y-2 pt-1">{ONBOARDING_STEPS[1]!.documents.map(slot)}</div>
            </StepPanel>
          ) : null}

          {current === 'coverage' ? (
            <StepPanel
              id="coverage"
              onSend={() => send('coverage')}
              outstanding={outstanding('coverage')}
            >
              <Field
                label="Main office address"
                value={coverage.address}
                onChange={(e) => setCoverage({ ...coverage, address: e.target.value })}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  value={coverage.city}
                  onChange={(e) => setCoverage({ ...coverage, city: e.target.value })}
                  required
                />
                <Field
                  label="Area you cover"
                  value={coverage.areaLabel}
                  onChange={(e) => setCoverage({ ...coverage, areaLabel: e.target.value })}
                  placeholder="Accra Central"
                />
              </div>
              <Field
                label="How far from the office do you operate? (km)"
                type="number"
                value={coverage.radiusKm}
                onChange={(e) => setCoverage({ ...coverage, radiusKm: e.target.value })}
                hint="A hard limit on routing — staff are never sent an incident outside it."
              />
              <div className="space-y-2 pt-1">
                {slot('premises_proof')}
                {slot('lease_agreement')}
                {slot('utility_bill')}
              </div>
            </StepPanel>
          ) : null}

          {current === 'documents' ? (
            <StepPanel
              id="documents"
              onSend={() => send('documents')}
              outstanding={outstanding('documents')}
            >
              <div className="space-y-2">
                {(Object.keys(DOCUMENT_REQUIREMENTS) as DocumentId[]).map(slot)}
              </div>
            </StepPanel>
          ) : null}

          {current === 'review' ? (
            <Panel className="p-5">
              <h2 className="text-sm font-semibold">Review and submit</h2>
              <p className="mt-1 text-xs leading-relaxed text-text-muted">
                Once submitted, your application is locked while the platform team reviews it. If
                they need anything else they send that step back with a reason.
              </p>

              <dl className="mt-4 space-y-3">
                <Summary
                  label="Organisation"
                  value={org.legalName || '—'}
                  extra={org.registrationNumber}
                />
                <Summary
                  label="Authorised officer"
                  value={officer.name || '—'}
                  extra={officer.role}
                />
                <Summary
                  label="Coverage"
                  value={coverage.city || '—'}
                  extra={`${coverage.radiusKm} km`}
                />
                <Summary
                  label="Documents"
                  value={`${application.documents.length} attached`}
                  extra={missing.length > 0 ? `${missing.length} missing` : 'all present'}
                />
              </dl>

              {problem ? (
                <p className="mt-4 rounded-sm bg-warning-wash/45 px-3 py-2.5 text-xs text-text-secondary">
                  {SUBMIT_PROBLEM[problem]}
                </p>
              ) : null}

              <Button
                size="lg"
                className="mt-4"
                disabled={problem !== null}
                onClick={() =>
                  setApplication((prev) => ({
                    ...prev,
                    submittedAtIso: new Date().toISOString(),
                  }))
                }
              >
                <Send className="h-3.5 w-3.5" /> Submit application
              </Button>
            </Panel>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function StepPanel({
  id,
  children,
  onSend,
  outstanding,
}: {
  id: OnboardingStepId;
  children: React.ReactNode;
  onSend: () => void;
  /** What is still missing. Empty means the step can be sent. */
  outstanding: string[];
}) {
  const meta = ONBOARDING_STEPS.find((m) => m.id === id)!;
  const ready = outstanding.length === 0;

  return (
    <Panel className="space-y-4 p-5">
      <div>
        <h2 className="text-sm font-semibold">{meta.label}</h2>
        <p className="mt-1 text-xs text-text-muted">{meta.description}</p>
      </div>

      {children}

      <div className="flex items-center justify-between gap-4 pt-1">
        {/* The reason sits beside the button, not in a toast after clicking —
            the point is to answer "why can't I continue" before it is asked. */}
        {ready ? (
          <span />
        ) : (
          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-warning">
            <AlertCircle className="mt-px h-3 w-3 shrink-0" />
            <span>Still needed: {outstanding.join(', ')}.</span>
          </p>
        )}
        <Button disabled={!ready} onClick={onSend} className="shrink-0">
          Send for review <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </Panel>
  );
}

function Summary({ label, value, extra }: { label: string; value: string; extra?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-hairline/[0.06] pb-2.5 last:border-0">
      <dt className="text-xs text-text-muted">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="block truncate text-xs font-medium capitalize">{value}</span>
        {extra ? <span className="block truncate text-2xs text-text-faint">{extra}</span> : null}
      </dd>
    </div>
  );
}
