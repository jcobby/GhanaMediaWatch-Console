'use client';

import { useMemo, useState } from 'react';
import {
  Building2,
  Check,
  Clock,
  MapPin,
  Search,
  UserPlus,
  X,
  ShieldCheck,
  CircleSlash,
} from 'lucide-react';
import type {
  Branch,
  BusinessAccount,
  Employee,
  EmployeeDuty,
  Invite,
  MembershipRequest,
  OrgAffiliation,
  ShiftStatus,
} from '@dawuro/core';
import { formatRelativeTime } from '@dawuro/core';
import { Badge, Button, Panel } from '@/components/ui';
import { InvitePanel } from '@/components/InvitePanel';
import { AffiliationPanel } from '@/components/AffiliationPanel';
import { cn } from '@/lib/cn';

type Tab = 'staff' | 'requests' | 'invites' | 'linked' | 'branches';

const DUTY_LABEL: Record<EmployeeDuty, string> = {
  field_response: 'Field response',
  dispatch: 'Dispatch',
  investigation: 'Investigation',
  inspection: 'Inspection',
  media: 'Media',
  community_liaison: 'Community liaison',
  admin: 'Admin',
};

const SHIFT: Record<ShiftStatus, { label: string; tone: 'success' | 'neutral' | 'warning' }> = {
  on_duty: { label: 'On duty', tone: 'success' },
  off_duty: { label: 'Off duty', tone: 'neutral' },
  on_leave: { label: 'On leave', tone: 'warning' },
};

/**
 * Managing the people in an organisation.
 *
 * Three things live together here because they are the same job: who works for
 * you, who is asking to, and where they work from.
 *
 * Join requests sit beside the staff list rather than in a separate settings
 * page. Someone waiting to be accepted cannot receive a single report, so a
 * pending request is an operational gap, not an administrative chore — and it
 * should be visible to the person who can close it.
 */
export function TeamWorkspace({
  employees,
  branches,
  requests,
  invites,
  affiliations,
  businesses,
  businessId,
}: {
  employees: Employee[];
  branches: Branch[];
  requests: MembershipRequest[];
  invites: Invite[];
  affiliations: OrgAffiliation[];
  businesses: BusinessAccount[];
  businessId: string;
}) {
  const [tab, setTab] = useState<Tab>('staff');
  const [query, setQuery] = useState('');
  const [decided, setDecided] = useState<Record<string, 'accepted' | 'rejected'>>({});
  const [roster, setRoster] = useState(employees);

  const branchName = useMemo(() => new Map(branches.map((b) => [b.id, b.name])), [branches]);

  const pending = requests.filter((r) => !(r.id in decided));

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return roster;
    return roster.filter(
      (e) =>
        e.displayName.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.duties.some((d) => DUTY_LABEL[d].toLowerCase().includes(q)) ||
        (e.branchId ? (branchName.get(e.branchId) ?? '').toLowerCase().includes(q) : false),
    );
  }, [query, roster, branchName]);

  const decide = (request: MembershipRequest, outcome: 'accepted' | 'rejected') => {
    setDecided((prev) => ({ ...prev, [request.id]: outcome }));
    if (outcome !== 'accepted') return;

    /*
     * An accepted person starts off duty with no specialisations and the
     * lowest role. Everything that determines what reaches them is set
     * deliberately afterwards rather than guessed at here — the cost of an
     * over-permissioned new joiner is far higher than the cost of one more
     * click.
     */
    setRoster((prev) => [
      ...prev,
      {
        id: `emp_new_${request.id}`,
        businessId: request.businessId,
        branchId: request.requestedBranchId,
        displayName: request.displayName,
        email: request.email,
        phone: request.phone,
        role: 'viewer',
        duties: [],
        specialisations: [],
        languages: ['en'],
        shiftStatus: 'off_duty',
        openAssignments: 0,
        maxConcurrentAssignments: 5,
        lastKnownLocation: null,
        lastSeenAtIso: null,
        acknowledgementRate: 1,
        joinedAtIso: new Date().toISOString(),
        active: true,
      },
    ]);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-7 py-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-0.5 rounded-sm bg-canvas-raise/70 p-0.5">
            {(
              [
                ['staff', `Staff ${roster.length}`],
                ['requests', `Requests ${pending.length}`],
                ['invites', `Invites ${invites.length}`],
                ['linked', 'Linked'],
                ['branches', `Branches ${branches.length}`],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setTab(key as Tab)}
                aria-pressed={tab === key}
                className={cn(
                  'rounded-xs px-3.5 py-1.5 text-xs transition',
                  tab === key
                    ? 'bg-canvas-soft font-medium text-text-primary shadow-sm'
                    : 'text-text-muted hover:text-text-primary',
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === 'staff' ? (
            <div className="relative w-64">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-faint" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name, duty or branch"
                aria-label="Search staff"
                className="h-8 w-full rounded-sm border border-hairline/12 bg-canvas-soft pl-8 pr-2.5 text-xs placeholder:text-text-faint focus:border-accent"
              />
            </div>
          ) : null}
        </div>

        {tab === 'staff' ? (
          <div className="mt-4 space-y-1.5">
            {visible.length === 0 ? (
              <Panel className="p-8 text-center text-xs text-text-faint">
                Nobody matches that search.
              </Panel>
            ) : (
              visible.map((e) => (
                <StaffRow key={e.id} employee={e} branchName={branchName.get(e.branchId ?? '')} />
              ))
            )}
          </div>
        ) : null}

        {tab === 'requests' ? (
          <div className="mt-4 space-y-2">
            {pending.length === 0 ? (
              <Panel className="p-8 text-center">
                <p className="text-sm">Nobody is waiting</p>
                <p className="mt-1 text-xs text-text-muted">
                  People who sign up and name your organisation appear here.
                </p>
              </Panel>
            ) : (
              pending.map((r) => (
                <RequestRow
                  key={r.id}
                  request={r}
                  branchName={branchName.get(r.requestedBranchId ?? '')}
                  onDecide={decide}
                />
              ))
            )}
          </div>
        ) : null}

        {tab === 'invites' ? (
          <div className="mt-4">
            {/* Origin is read at render time so a copied link always points at
                the host the admin is actually using. */}
            <InvitePanel
              invites={invites}
              baseUrl={typeof window === 'undefined' ? '' : window.location.origin}
            />
          </div>
        ) : null}

        {tab === 'linked' ? (
          <div className="mt-4">
            <AffiliationPanel
              businessId={businessId}
              affiliations={affiliations}
              businesses={businesses}
            />
          </div>
        ) : null}

        {tab === 'branches' ? (
          <div className="mt-4 space-y-2">
            {branches.map((b) => (
              <Panel key={b.id} className="flex items-center gap-3.5 p-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-sm bg-canvas-raise">
                  <Building2 className="h-4 w-4 text-text-muted" strokeWidth={1.75} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{b.name}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                    <MapPin className="h-3 w-3" />
                    {b.areaLabel}
                    <span className="text-text-faint">
                      · covers {(b.jurisdictionRadiusM / 1000).toFixed(1)} km
                    </span>
                  </p>
                </div>
                <span className="tabular shrink-0 text-xs text-text-muted">
                  {roster.filter((e) => e.branchId === b.id).length} staff
                </span>
              </Panel>
            ))}
            <Panel className="flex items-start gap-3 p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
              <p className="text-xs leading-relaxed text-text-muted">
                A branch&rsquo;s area is a hard limit on routing, not a preference. Staff are never
                sent an incident outside the area their branch covers, because acting on it is not
                theirs to do.
              </p>
            </Panel>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StaffRow({ employee, branchName }: { employee: Employee; branchName?: string }) {
  const shift = SHIFT[employee.shiftStatus];
  const atCapacity = employee.openAssignments >= employee.maxConcurrentAssignments;

  return (
    <Panel className="flex items-center gap-3.5 p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-canvas-raise text-2xs font-semibold text-text-muted">
        {employee.displayName
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0])
          .join('')}
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium">{employee.displayName}</p>
          <Badge tone={shift.tone}>{shift.label}</Badge>
          {atCapacity ? <Badge tone="warning">At capacity</Badge> : null}
        </div>
        <p className="mt-0.5 truncate text-xs text-text-muted">
          {employee.duties.length > 0
            ? employee.duties.map((d) => DUTY_LABEL[d]).join(' · ')
            : 'No duties assigned'}
          {branchName ? <span className="text-text-faint"> — {branchName}</span> : null}
        </p>
      </div>

      <div className="hidden shrink-0 items-center gap-5 sm:flex">
        <Stat
          label="Open"
          value={`${employee.openAssignments}/${employee.maxConcurrentAssignments}`}
        />
        <Stat label="Acks" value={`${Math.round(employee.acknowledgementRate * 100)}%`} />
        <Stat label="Seen" value={formatRelativeTime(employee.lastSeenAtIso) ?? '—'} />
      </div>

      <span className="shrink-0 rounded-pill bg-canvas-raise px-2 py-0.5 text-2xs capitalize text-text-muted">
        {employee.role}
      </span>
    </Panel>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-right">
      <p className="text-2xs uppercase tracking-wider text-text-faint">{label}</p>
      <p className="tabular mt-px text-xs font-medium">{value}</p>
    </div>
  );
}

function RequestRow({
  request,
  branchName,
  onDecide,
}: {
  request: MembershipRequest;
  branchName?: string;
  onDecide: (r: MembershipRequest, outcome: 'accepted' | 'rejected') => void;
}) {
  return (
    <Panel className="p-4">
      <div className="flex items-start gap-3.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-accent-wash text-2xs font-semibold text-accent">
          <UserPlus className="h-4 w-4" strokeWidth={1.9} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-medium">{request.displayName}</p>
            {/*
             * Whether the address was verified by an identity provider is the
             * single most useful fact for the reviewer, so it is stated rather
             * than left for them to infer from the domain.
             */}
            {request.emailVerified ? (
              <Badge tone="success">Verified by Google</Badge>
            ) : (
              <Badge tone="warning">Unverified email</Badge>
            )}
          </div>
          <p className="mt-0.5 text-xs text-text-muted">{request.email}</p>
          <p className="mt-1.5 text-xs text-text-secondary">
            Says they are: <span className="font-medium">{request.statedRole}</span>
            {branchName ? <span className="text-text-muted"> — {branchName}</span> : null}
          </p>
          {request.note ? (
            <p className="mt-1 text-xs italic text-text-muted">&ldquo;{request.note}&rdquo;</p>
          ) : null}
          <p className="mt-2 flex items-center gap-1.5 text-2xs text-text-faint">
            <Clock className="h-3 w-3" />
            Asked {formatRelativeTime(request.requestedAtIso) ?? 'recently'}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => onDecide(request, 'rejected')}>
            <X className="h-3.5 w-3.5" /> Decline
          </Button>
          <Button size="sm" onClick={() => onDecide(request, 'accepted')}>
            <Check className="h-3.5 w-3.5" /> Accept
          </Button>
        </div>
      </div>

      <p className="mt-3 flex items-start gap-2 border-t border-hairline/[0.07] pt-3 text-2xs leading-relaxed text-text-muted">
        <CircleSlash className="mt-0.5 h-3 w-3 shrink-0 text-text-faint" />
        Accepting adds them as a viewer, off duty, with no duties or specialisations. Set those
        deliberately — they decide what reaches this person.
      </p>
    </Panel>
  );
}
