import { Info } from 'lucide-react';
import { PageHeader } from '@/components/shell';
import { Outage, load } from '@/components/ui';
import { COUNT_RANGE, DWELL_SECONDS_RANGE, readTopStories } from '@/lib/topStories';
import { TopStoriesForm } from './TopStoriesForm';

/**
 * The rhythm of the front page.
 *
 * The mobile feed no longer has one lead. Several stories share the top slot
 * and take turns, and two numbers decide how that reads: how many, and how long
 * each holds. A busy news day wants more stories moving faster; a quiet one
 * wants fewer holding longer. That is an editorial judgement, which is why it is
 * a control on this desk rather than a constant compiled into an app nobody can
 * change without a release.
 *
 * **Which stories is the editors' call, not this page's.** Editors lead reports
 * from the verification desk; the rotation takes led reports first, then the
 * newest. This page decides only how many and how long.
 */
export default async function Page() {
  const result = await load(() => readTopStories());

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Top stories"
        description="How many stories lead the mobile feed, and how long each one holds."
      />

      {!result.ok ? (
        <Outage error={result.error} retryHref="/platform/top-stories" />
      ) : (
        <>
          {/*
            What saving does, said where the control is. The warning that stood
            here — "saved here, not yet sent to phones" — was true until the
            service carried the setting, and a stale warning is how an operator
            learns to read past the real ones.
          */}
          <div className="mx-7 mt-5 flex items-start gap-3 rounded-md border border-info/25 bg-info-wash/40 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" strokeWidth={2} />
            <p className="min-w-0 text-xs leading-relaxed text-text-muted">
              <span className="font-semibold text-text-primary">Sent to every phone.</span> A
              change reaches the app within five minutes. Which stories lead is chosen by editors on
              the verification desk; led stories come first, then the newest.
            </p>
          </div>

          <TopStoriesForm
            initial={{
              count: result.data.count,
              // Entered in seconds, served in milliseconds. Nobody types 6000.
              dwellSeconds: Math.round(result.data.dwellMs / 1000),
              updatedAtIso: result.data.updatedAtIso,
              updatedByEmail: result.data.updatedByEmail,
            }}
            bounds={{
              count: { min: COUNT_RANGE.min, max: COUNT_RANGE.max },
              dwell: { min: DWELL_SECONDS_RANGE.min, max: DWELL_SECONDS_RANGE.max },
            }}
          />
        </>
      )}
    </>
  );
}
