'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
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
  type StepState,
  type UploadedDocument,
} from '@dawuro/core';
import { Button, Field, Panel } from '@/components/ui';
import type { HeldApplication, OnboardingProgress, StoredDocument } from '@/lib/applications';
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
  held,
}: {
  initial: OnboardingApplication;
  organisationName: string;
  /**
   * The application this console is holding, when it is holding one.
   *
   * Present for somebody who registered here, which is everybody today — the
   * backend has no endpoint that creates an organisation. Its presence is what
   * makes this wizard save: without it every keystroke, every attached document
   * and the submit button itself were React state with no request behind them,
   * discarded on navigation while the confirmation screen said the application
   * had been received.
   */
  held?: HeldApplication;
}) {
  const router = useRouter();
  const [application, setApplication] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<DocumentId | null>(null);
  const [uploadError, setUploadError] = useState<{ id: DocumentId; message: string } | null>(null);
  const [stored, setStored] = useState<StoredDocument[]>(held?.onboarding?.documents ?? []);

  const [current, setCurrent] = useState<OnboardingStepId | 'review'>(
    nextStepFor(initial) ?? 'review',
  );

  // Step form values, held together so the review page can read them back.
  /*
   * Prefilled from what was already saved, so returning to a half-finished
   * application shows the work rather than an empty form. That was the visible
   * half of the wizard saving nothing: every answer came back blank.
   */
  const [org, setOrg] = useState(
    held?.onboarding?.organisation ?? {
      legalName: organisationName,
      registrationNumber: '',
      tin: '',
    },
  );
  const [officer, setOfficer] = useState(
    held?.onboarding?.officer ?? { name: '', role: '', idNumber: '', phone: '' },
  );
  const [coverage, setCoverage] = useState(
    held?.onboarding?.coverage ?? { address: '', city: '', areaLabel: '', radiusKm: '10' },
  );

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

  /**
   * Everything the applicant has entered, in the shape the store keeps.
   *
   * Steps and documents are passed in rather than read from state: this is
   * called immediately after a state update, and React state is not yet the new
   * value at that point — so the very step somebody just completed would be the
   * one thing missing from what gets written.
   */
  const progressOf = (steps: StepState[], documents: StoredDocument[]): OnboardingProgress => ({
    organisation: org,
    officer,
    coverage,
    documents,
    steps,
  });

  /** Write progress to the server. Returns false when nothing was saved. */
  const save = async (progress: OnboardingProgress, action: 'save' | 'submit') => {
    // No held application means the backend owns this one, and there is
    // nowhere here to write it. The wizard behaves as it always did.
    if (!held) return true;

    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, progress }),
      });
      if (!res.ok) {
        const answer = (await res.json()) as { error?: string };
        setSaveError(answer.error ?? 'That could not be saved. Try again.');
        return false;
      }
      return true;
    } catch {
      setSaveError('The console could not reach its own server. Nothing was saved.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const stepsWith = (id: OnboardingStepId, status: 'in_progress' | 'submitted'): StepState[] => [
    ...application.steps.filter((s) => s.id !== id),
    {
      id,
      status,
      rejectionReason: null,
      submittedAtIso: status === 'submitted' ? new Date().toISOString() : null,
      reviewedAtIso: null,
      reviewedBy: null,
    },
  ];

  /**
   * Send one step for review.
   *
   * The state only moves once the server has it. Before, this was `setStatus`
   * alone: the step ticked over, the rail advanced, and nothing had been
   * written anywhere — so an applicant watched four steps complete and lost all
   * of it on navigation.
   */
  const send = async (id: OnboardingStepId) => {
    const steps = stepsWith(id, 'submitted');
    if (!(await save(progressOf(steps, stored), 'save'))) return;

    setApplication((prev) => ({ ...prev, steps }));
    const remaining = ONBOARDING_STEPS.find(
      (m) =>
        m.id !== id && !['submitted', 'approved'].includes(stepState(application, m.id).status),
    );
    setCurrent(remaining?.id ?? 'review');
  };

  /**
   * Attach a document — the file, not its name.
   *
   * The bytes go to the server first and the slot only shows as attached once
   * they are stored. A tick before the upload lands is how an applicant submits
   * an application whose certificate never arrived.
   */
  const upload = async (id: DocumentId, file: File) => {
    if (!held) return;

    setUploading(id);
    setUploadError(null);
    try {
      const form = new FormData();
      form.append('documentId', id);
      form.append('file', file);
      const res = await fetch('/api/onboarding/documents', { method: 'POST', body: form });

      /*
       * Read as text first, then parse.
       *
       * `res.json()` throws on any response that is not JSON, and that throw
       * lands in the catch below — which reports "the upload did not complete",
       * a message about the network. The real answer was a server error page,
       * and it was being converted into a misleading sentence about something
       * else. An upload that failed for a reason the server explained should
       * say what the server said.
       */
      const raw = await res.text();
      let answer: (StoredDocument & { error?: string }) | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as StoredDocument & { error?: string }) : null;
      } catch {
        answer = null;
      }

      if (!res.ok || !answer) {
        setUploadError({
          id,
          message:
            answer?.error ??
            `That file could not be attached — the service answered ${res.status}.`,
        });
        return;
      }

      const documents = [...stored.filter((d) => d.id !== id), answer];
      setStored(documents);
      setApplication((prev) => ({
        ...prev,
        documents: [
          ...prev.documents.filter((d) => d.id !== id),
          { id, fileName: answer.fileName, uploadedAtIso: answer.uploadedAtIso, reviewedOk: null },
        ],
      }));
      // Persisted with the rest of the form, so a reload keeps the attachment.
      await save(progressOf(application.steps, documents), 'save');
    } catch {
      setUploadError({ id, message: 'The upload did not complete. Try again.' });
    } finally {
      setUploading(null);
    }
  };

  const remove = async (id: DocumentId) => {
    const documents = stored.filter((d) => d.id !== id);
    setStored(documents);
    setApplication((prev) => ({
      ...prev,
      documents: prev.documents.filter((d) => d.id !== id),
    }));
    await save(progressOf(application.steps, documents), 'save');
  };

  /**
   * Send the whole application for review.
   *
   * The state moves only after the server has accepted it, and the page is
   * re-read rather than switched locally — the confirmation an applicant sees
   * is then the server's answer rather than an assumption made in the browser.
   */
  const submit = async () => {
    if (!(await save(progressOf(application.steps, stored), 'submit'))) return;
    setApplication((prev) => ({ ...prev, submittedAtIso: new Date().toISOString() }));
    router.refresh();
  };

  const docFor = (id: DocumentId): UploadedDocument | null =>
    application.documents.find((d) => d.id === id) ?? null;

  const slot = (id: DocumentId) => (
    <DocumentSlot
      key={id}
      id={id}
      uploaded={docFor(id)}
      satisfiedByAlternative={docFor(id) === null && documentSatisfied(application, id)}
      onUpload={(file) => void upload(id, file)}
      onRemove={() => void remove(id)}
      busy={uploading === id}
      error={uploadError?.id === id ? uploadError.message : null}
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
              onSend={() => void send('organisation')}
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
              onSend={() => void send('officer')}
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
              onSend={() => void send('coverage')}
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
              onSend={() => void send('documents')}
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

              {/*
                Submitting used to set a timestamp in React state and tell
                nobody. The applicant saw "Application submitted", and no
                operator ever saw the application — it did not exist outside
                that browser tab, and was gone on the next navigation. This is
                the request that puts it in front of the Dawuro owner.
              */}
              {saveError ? (
                <p className="mt-4 rounded-sm border border-danger/25 bg-danger-wash px-3 py-2.5 text-xs text-danger">
                  {saveError}
                </p>
              ) : null}

              <Button
                size="lg"
                className="mt-4"
                disabled={problem !== null || saving}
                onClick={() => void submit()}
              >
                <Send className="h-3.5 w-3.5" />
                {saving ? 'Sending…' : 'Submit application'}
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
