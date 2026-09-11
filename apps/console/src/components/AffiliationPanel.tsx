'use client';

import { ArrowRight, Building2, Eye, EyeOff, Handshake } from 'lucide-react';
import {
  formatRelativeTime,
  type AffiliationKind,
  type OrganisationAccount,
  type OrgAffiliation,
} from '@dawuro/core';
import { Badge, Panel } from '@/components/ui';

const KIND_LABEL: Record<AffiliationKind, string> = {
  subsidiary: 'Subsidiary',
  partner: 'Partner',
  agent: 'Agent',
};

/**
 * Organisations linked to this one.
 *
 * The direction of the arrow is the substance of the relationship, so it is
 * drawn rather than described. Whether reports are shared is stated on every
 * row, in words, because it is the single thing that matters and the single
 * thing nobody remembers agreeing to.
 *
 * Sharing runs one way only. An agent never gains sight of the organisation
 * that engaged it by virtue of being engaged — the reverse of what a careless
 * implementation produces.
 */
export function AffiliationPanel({
  businessId,
  affiliations,
  organisations,
}: {
  businessId: string;
  affiliations: OrgAffiliation[];
  organisations: OrganisationAccount[];
}) {
  const nameOf = (id: string) => organisations.find((b) => b.id === id)?.name ?? id;

  const mine = affiliations.filter(
    (a) => a.parentBusinessId === businessId || a.affiliateBusinessId === businessId,
  );

  if (mine.length === 0) {
    return (
      <Panel className="p-8 text-center">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-canvas-raise">
          <Handshake className="h-4 w-4 text-text-muted" strokeWidth={1.8} />
        </div>
        <p className="mt-3 text-sm">No linked organisations</p>
        <p className="mt-1 text-xs text-text-muted">
          Invite another organisation from the Invites tab to link with them.
        </p>
      </Panel>
    );
  }

  return (
    <div className="space-y-1.5">
      {mine.map((a) => {
        const outgoing = a.parentBusinessId === businessId;
        const other = outgoing ? a.affiliateBusinessId : a.parentBusinessId;

        return (
          <Panel key={a.id} className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={a.status === 'active' ? 'success' : 'warning'}>
                {a.status === 'active' ? 'Active' : 'Awaiting acceptance'}
              </Badge>
              <Badge tone="neutral">{KIND_LABEL[a.kind]}</Badge>
              <span className="text-2xs text-text-faint">
                since {formatRelativeTime(a.createdAtIso) ?? 'recently'}
              </span>
            </div>

            {/* Direction, drawn. Which organisation invited which decides who
                can see whose reports, and a sentence hides that. */}
            <div className="mt-3 flex items-center gap-2.5">
              <OrgChip name={outgoing ? 'Your organisation' : nameOf(other)} emphasis={outgoing} />
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-text-faint" />
              <OrgChip name={outgoing ? nameOf(other) : 'Your organisation'} emphasis={!outgoing} />
            </div>

            <p className="mt-3 flex items-start gap-2 border-t border-hairline/[0.07] pt-3 text-xs leading-relaxed text-text-muted">
              {a.sharesReports ? (
                <Eye className="mt-0.5 h-3.5 w-3.5 shrink-0 text-info" />
              ) : (
                <EyeOff className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-faint" />
              )}
              {a.sharesReports
                ? outgoing
                  ? `You can see the reports ${nameOf(other)} licenses.`
                  : `${nameOf(other)} can see the reports you license.`
                : 'Neither organisation can see the other’s reports.'}
            </p>
          </Panel>
        );
      })}
    </div>
  );
}

function OrgChip({ name, emphasis }: { name: string; emphasis: boolean }) {
  return (
    <span
      className={
        emphasis
          ? 'flex min-w-0 items-center gap-1.5 rounded-sm bg-accent-wash px-2.5 py-1.5 text-xs font-medium text-accent'
          : 'flex min-w-0 items-center gap-1.5 rounded-sm bg-canvas-raise px-2.5 py-1.5 text-xs text-text-secondary'
      }
    >
      <Building2 className="h-3 w-3 shrink-0" />
      <span className="truncate">{name}</span>
    </span>
  );
}
