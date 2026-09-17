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
  type UploadedDocument,
} from '@dawuro/core';
import { Button, Field, Panel } from '@/components/ui';
import { StepRail } from '@/components/StepRail';
import { DocumentSlot } from '@/components/DocumentSlot';
import { fieldOf, type OnboardingView } from '@/lib/onboarding';

const SUBMIT_PROBLEM: Record<string, string> = {
  steps_outstanding: 'Some steps have not been sent yet.',
  documents_missing: 'Some required documents are still missing.',
  already_submitted: 'This application has already been submitted.',
};

/** The service's own ceiling, checked here so a large scan fails before it is read. */
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The organisation's onboarding wizard.
 *
 * Registration establishes who is asking. This collects the evidence, one step
 * at a time, and each step is *sent for review* rather than ticked off —
 * completing a step never approves it.
 *
 * Every change is written to the service through `/api/onboarding`, and the
 * screen then shows the application the service sent back. It used to write to
 * a file on the console's own disk, which the platform owner could only see on
 * the same machine and which a redeploy erased.
 *
 * Steps can be done in any order. Real applicants gather documents at whatever
 * pace the documents arrive, and forcing a strict sequence means an application
 * stalls entirely because one certificate is with a lawyer.
 */
export function OnboardingWizard({
  initial,
  initialPayloads,
  organisationName,
}: {
  initial: OnboardingApplication;
  initialPayloads: OnboardingView['payloads'];
  organisationName: string;
}) {
  const router = useRouter();
  const [application, setApplication] = useState(initial);
  const [payloads, setPayloads] = useState(initialPayloads);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<DocumentId | null>(null);
  const [uploadError, setUploadError] = useState<{ id: DocumentId; message: string } | null>(null);
  /** The step with answers typed since it was last saved. */
  const [dirty, setDirty] = useState<OnboardingStepId | null>(null);

  const [current, setCurrent] = useState<OnboardingStepId | 'review'>(
    nextStepFor(initial) ?? 'review',
  );

  // Prefilled from what the service holds, so returning shows the work.
  const [org, setOrg] = useState({
    legalName: fieldOf(initialPayloads.organisation, 'legalName') || organisationName,
    registrationNumber: fieldOf(initialPayloads.organisation, 'registrationNumber'),
    tin: fieldOf(initialPayloads.organisation, 'tin'),
  });
  const [officer, setOfficer] = useState({
    name: fieldOf(initialPayloads.officer, 'name'),
    role: fieldOf(initialPayloads.officer, 'role'),
    idNumber: fieldOf(initialPayloads.officer, 'idNumber'),
    phone: fieldOf(initialPayloads.officer, 'phone'),
  });
  const [coverage, setCoverage] = useState({
    address: fieldOf(initialPayloads.coverage, 'address'),
    city: fieldOf(initialPayloads.coverage, 'city'),
    areaLabel: fieldOf(initialPayloads.coverage, 'areaLabel'),
    radiusKm: fieldOf(initialPayloads.coverage, 'radiusKm') || '10',
  });

  const updateOrg = (patch: Partial<typeof org>) => {
    setOrg((prev) => ({ ...prev, ...patch }));
    setDirty('organisation');
  };
  const updateOfficer = (patch: Partial<typeof officer>) => {
    setOfficer((prev) => ({ ...prev, ...patch }));
    setDirty('officer');
  };
  const updateCoverage = (patch: Partial<typeof coverage>) => {
    setCoverage((prev) => ({ ...prev, ...patch }));
    setDirty('coverage');
  };

  const missing = useMemo(() => missingDocuments(application), [application]);
  const problem = submitProblem(application);

  /*
   * What each step is still waiting for, in the applicant's words.
   *
   * Returned as a list rather than a boolean so the button can say why it is
   * disabled. The checks ask only whether something was answered: a
   * three-character address is a real address.
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
   * A step's answers, merged over what the service already holds.
   *
   * Merged rather than replaced because the organisation step also carries what
   * registration collected — interests, plan, phone — and the wizard has no
   * fields for those. Saving the step with only the three on screen would erase
   * the categories routing matches reports against.
   */
  const payloadFor = (id: OnboardingStepId): Record<string, unknown> => ({
    ...(payloads[id] ?? {}),
    ...(id === 'organisation' ? org : {}),
    ...(id === 'officer' ? officer : {}),
    ...(id === 'coverage' ? { ...coverage, radiusKm: Number(coverage.radiusKm) } : {}),
  });

  /**
   * One request to the console's server, and the application it answers with.
   *
   * Read as text, then parsed: `res.json()` throws on a non-JSON body and the
   * catch would report a network failure for what was really a server's
   * explanation.
   */
  const call = async (
    body: Record<string, unknown>,
    onError: (message: string) => void = setSaveError,
  ): Promise<OnboardingView | null> => {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const raw = await res.text();
      let answer: (OnboardingView & { error?: string }) | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as OnboardingView & { error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok || !answer?.application) {
        onError(answer?.error ?? `That could not be saved — the service answered ${res.status}.`);
        return null;
      }
      setApplication(answer.application);
      setPayloads(answer.payloads);
      return answer;
    } catch {
      onError('The console could not reach its own server. Nothing was saved.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  /**
   * Keep what was typed when the applicant moves to another step.
   *
   * Only a step with unsaved answers is written, so opening a step and leaving
   * it does not mark it started.
   */
  const select = (next: OnboardingStepId | 'review') => {
    if (dirty && dirty === current) {
      void call({ action: 'save', stepId: dirty, payload: payloadFor(dirty) });
      setDirty(null);
    }
    setCurrent(next);
  };

  /**
   * Send one step for review.
   *
   * The rail moves only once the service has the step. Advancing first is how
   * an applicant once watched four steps complete with nothing written anywhere.
   */
  const send = async (id: OnboardingStepId) => {
    const view = await call({ action: 'send', stepId: id, payload: payloadFor(id) });
    if (!view) return;
    setDirty(null);
    const remaining = ONBOARDING_STEPS.find(
      (m) => !['submitted', 'approved'].includes(stepState(view.application, m.id).status),
    );
    setCurrent(remaining?.id ?? 'review');
  };

  /**
   * Attach a document: declare it, then send the file.
   *
   * Two requests, because that is what the service offers. The first records the
   * name and a SHA-256 fingerprint computed here from the bytes, so the record
   * names *this* file and a different file under the same name does not match
   * it. The second sends the bytes, which the service checks against that
   * fingerprint before it counts the document as attached.
   *
   * **The second request is new.** Until 16 September there was nowhere to send
   * a file, so this recorded a name and a hash and left the document on the
   * applicant's computer — and a platform owner approved an organisation's
   * access to citizens' footage on the strength of a filename. An upload that
   * declares and then fails to send is reported as a failure rather than left
   * looking attached, because a half-done attachment is the same lie in a
   * quieter form.
   */
  const upload = async (id: DocumentId, file: File) => {
    setUploadError(null);
    if (file.size === 0) {
      setUploadError({ id, message: 'That file is empty. Choose the document again.' });
      return;
    }
    if (file.size > MAX_BYTES) {
      setUploadError({ id, message: 'That file is larger than 25 MB. Attach a smaller copy.' });
      return;
    }

    setUploading(id);
    try {
      const sha256 = await fingerprint(file);
      const declared = await call(
        {
          action: 'document',
          documentType: id,
          fileName: file.name,
          sha256,
          mimeType: file.type,
          byteSize: file.size,
        },
        (message) => setUploadError({ id, message }),
      );
      if (!declared) return;

      const res = await fetch(`/api/onboarding?documentType=${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': file.type || 'application/octet-stream' },
        body: file,
      });
      const raw = await res.text();
      let answer: (OnboardingView & { error?: string }) | null = null;
      try {
        answer = raw ? (JSON.parse(raw) as OnboardingView & { error?: string }) : null;
      } catch {
        answer = null;
      }
      if (!res.ok || !answer?.application) {
        setUploadError({
          id,
          message: answer?.error ?? `The file did not upload — the service answered ${res.status}.`,
        });
        return;
      }
      // The application as the service now holds it, so the slot cannot show a
      // document as attached that the upload did not complete.
      setApplication(answer.application);
      setPayloads(answer.payloads);
    } catch {
      setUploadError({ id, message: 'That file could not be read. Try again.' });
    } finally {
      setUploading(null);
    }
  };

  /**
   * Send the whole application for review.
   *
   * The confirmation is the service's answer, re-read, rather than a timestamp
   * set in the browser.
   */
  const submit = async () => {
    const view = await call({ action: 'submit' });
    if (view) router.refresh();
  };

  const docFor = (id: DocumentId): UploadedDocument | null =>
    application.documents.find((d) => d.id === id) ?? null;

  /*
   * No remove button: the service has no way to detach a document. An attached
   * slot offers "Replace" instead, which records the new file over the old one.
   */
  const slot = (id: DocumentId) => (
    <DocumentSlot
      key={id}
      id={id}
      uploaded={docFor(id)}
      satisfiedByAlternative={docFor(id) === null && documentSatisfied(application, id)}
      onUpload={(file) => void upload(id, file)}
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

  const rejected =
    current === 'review' ? null : stepState(application, current).rejectionReason;
  const sentAlready = (id: OnboardingStepId) =>
    ['submitted', 'approved'].includes(stepState(application, id).status);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-6 sm:px-7 lg:flex-row lg:gap-7">
        <aside className="w-full shrink-0 lg:w-56">
          <StepRail application={application} current={current} onSelect={select} />
        </aside>

        <div className="min-w-0 flex-1">
          {/* The service's own words, on whichever step failed to save. */}
          {saveError ? (
            <p
              role="alert"
              className="mb-3 rounded-sm border border-danger/25 bg-danger-wash px-3 py-2.5 text-xs text-danger"
            >
              {saveError}
            </p>
          ) : null}

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
              sent={sentAlready('organisation')}
              saving={saving}
            >
              <Field
                label="Registered legal name"
                value={org.legalName}
                onChange={(e) => updateOrg({ legalName: e.target.value })}
                hint="Exactly as it appears on the certificate."
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Registration number"
                  value={org.registrationNumber}
                  onChange={(e) => updateOrg({ registrationNumber: e.target.value })}
                  placeholder="CS-123456789"
                  required
                />
                <Field
                  label="Tax identification number"
                  value={org.tin}
                  onChange={(e) => updateOrg({ tin: e.target.value })}
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
              sent={sentAlready('officer')}
              saving={saving}
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
                  onChange={(e) => updateOfficer({ name: e.target.value })}
                  required
                />
                <Field
                  label="Position"
                  value={officer.role}
                  onChange={(e) => updateOfficer({ role: e.target.value })}
                  placeholder="Director of Operations"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="Ghana Card / passport number"
                  value={officer.idNumber}
                  onChange={(e) => updateOfficer({ idNumber: e.target.value })}
                  required
                />
                <Field
                  label="Direct phone"
                  type="tel"
                  value={officer.phone}
                  onChange={(e) => updateOfficer({ phone: e.target.value })}
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
              sent={sentAlready('coverage')}
              saving={saving}
            >
              <Field
                label="Main office address"
                value={coverage.address}
                onChange={(e) => updateCoverage({ address: e.target.value })}
                required
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field
                  label="City"
                  value={coverage.city}
                  onChange={(e) => updateCoverage({ city: e.target.value })}
                  required
                />
                <Field
                  label="Area you cover"
                  value={coverage.areaLabel}
                  onChange={(e) => updateCoverage({ areaLabel: e.target.value })}
                  placeholder="Accra Central"
                />
              </div>
              <Field
                label="How far from the office do you operate? (km)"
                type="number"
                value={coverage.radiusKm}
                onChange={(e) => updateCoverage({ radiusKm: e.target.value })}
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
              sent={sentAlready('documents')}
              saving={saving}
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

/** A file's SHA-256, as lowercase hex. */
async function fingerprint(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

function StepPanel({
  id,
  children,
  onSend,
  outstanding,
  sent,
  saving,
}: {
  id: OnboardingStepId;
  children: React.ReactNode;
  onSend: () => void;
  /** What is still missing. Empty means the step can be sent. */
  outstanding: string[];
  /** Already with the reviewer, or already approved. */
  sent: boolean;
  saving: boolean;
}) {
  const meta = ONBOARDING_STEPS.find((m) => m.id === id)!;
  const ready = outstanding.length === 0 && !sent;

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
        {sent ? (
          <p className="flex items-center gap-1.5 text-2xs text-text-muted">
            <Check className="h-3 w-3 text-success" /> Sent for review.
          </p>
        ) : outstanding.length === 0 ? (
          <span />
        ) : (
          <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-warning">
            <AlertCircle className="mt-px h-3 w-3 shrink-0" />
            <span>Still needed: {outstanding.join(', ')}.</span>
          </p>
        )}
        <Button disabled={!ready || saving} onClick={onSend} className="shrink-0">
          {saving ? 'Saving…' : 'Send for review'} <ArrowRight className="h-3.5 w-3.5" />
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
