import { redirect } from 'next/navigation';
import { roleCan } from '@dawuro/core';
import {
  Note,
  PageIntro,
  PageShell,
  Panel,
  Pill,
  Stat,
  StatGrid,
  Table,
} from '@/components/admin/Widgets';
import { requireSession } from '@/lib/session';

/**
 * Signing keys.
 *
 * Simulated: no key material exists yet, because the server-side signing this
 * page administers is itself unbuilt. The screen shows the shape of the thing
 * so the rotation rules can be argued about before they are implemented, which
 * is the cheaper order to do it in.
 */
const KEYS = [
  {
    id: 'cap-sign-2026-08',
    purpose: 'Capture integrity signature',
    algorithm: 'Ed25519',
    rotated: '3 days ago',
    signed: '18,402',
    state: 'active' as const,
  },
  {
    id: 'cap-sign-2026-05',
    purpose: 'Capture integrity signature',
    algorithm: 'Ed25519',
    rotated: '3 months ago',
    signed: '241,880',
    state: 'verify' as const,
  },
  {
    id: 'cap-sign-2026-02',
    purpose: 'Capture integrity signature',
    algorithm: 'Ed25519',
    rotated: '6 months ago',
    signed: '198,114',
    state: 'verify' as const,
  },
  {
    id: 'session-hs256',
    purpose: 'Console session tokens',
    algorithm: 'HS256',
    rotated: '3 days ago',
    signed: '—',
    state: 'active' as const,
  },
];

export default async function Page() {
  const session = await requireSession();
  if (!session.role || !roleCan(session.role, 'manage_keys')) redirect('/');

  return (
    <PageShell>
      <PageIntro title="Signing keys" blurb="The keys that make capture integrity mean anything." />

      <StatGrid>
        <Stat label="Active" value="2" tone="good" />
        <Stat label="Verify-only" value="2" hint="Retained for historical signatures" />
        <Stat label="Last rotation" value="3d" />
        <Stat label="Signatures held" value="458k" />
      </StatGrid>

      <Panel
        title="Keys"
        subtitle="A verify-only key is retired for signing but still needed — it is the only thing that can check what it signed."
      >
        <Table
          empty="No signing keys yet. Keys are provisioned with the service, not from this screen."
          columns={['Key', 'Purpose', 'Algorithm', 'Rotated', 'Signed', 'State']}
          rows={KEYS.map((k) => [
            <code key="k" className="text-xs text-text-primary">
              {k.id}
            </code>,
            <span key="p" className="text-xs text-text-muted">
              {k.purpose}
            </span>,
            <span key="a" className="text-xs text-text-muted">
              {k.algorithm}
            </span>,
            <span key="r" className="text-xs text-text-muted">
              {k.rotated}
            </span>,
            <span key="s" className="tabular text-text-muted">
              {k.signed}
            </span>,
            k.state === 'active' ? (
              <Pill key="st" tone="good">
                Active
              </Pill>
            ) : (
              <Pill key="st" tone="info">
                Verify-only
              </Pill>
            ),
          ])}
          align={[4]}
        />
      </Panel>

      <Note tone="warn">
        <span className="font-semibold">
          Rotation must never invalidate a historical signature.
        </span>{' '}
        A report signed in May is verified against the May key, not the current one. Retiring a key
        for signing and destroying it are different acts, and confusing them would silently
        reclassify every report that key ever touched down to Class B.
      </Note>

      <Note>
        The device never signs for itself — a compromised handset would sign whatever it liked. The
        signature is taken server-side over{' '}
        <code>(sha256, incidentId, serverReceivedAtIso, deviceId)</code> once the upload completes,
        and that is what <code>integritySignatureValid</code> later checks against.
      </Note>
    </PageShell>
  );
}
