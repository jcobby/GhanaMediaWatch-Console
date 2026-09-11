import { AlertTriangle } from 'lucide-react';
import { PageHeader } from '@/components/shell';
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
 * **Which stories, deliberately not.** The rotation is the top of the order the
 * service already returns — the judgement editors made when they published each
 * report to a section. A second ranking here would be the platform desk quietly
 * overruling the newsroom, and it would be invisible to the people whose
 * decisions it displaced.
 */
export default async function Page() {
  const settings = await readTopStories();

  return (
    <>
      <PageHeader
        eyebrow="Platform"
        title="Top stories"
        description="How many stories lead the mobile feed, and how long each one holds."
      />

      {/*
        Not `NotWired`, and the difference matters.

        `NotWired` says nothing is saved. That would be false here — this is
        written to disk and survives a reload. What it does not do is *reach a
        phone*, because the service carries no platform setting of any kind. An
        operator told the wrong one of those two things either re-enters a
        setting that was already saved, or waits for an effect that is not
        coming.
      */}
      <div className="mx-7 mt-5 flex items-start gap-3 rounded-md border border-warning/30 bg-warning-wash p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" strokeWidth={2} />
        <div className="min-w-0">
          <p className="text-xs font-semibold text-text-primary">
            Saved here, not yet sent to phones
          </p>
          <p className="mt-1 text-xs leading-relaxed text-text-muted">
            What you set is recorded and survives a reload. It does not reach the app yet — there is
            nowhere for the service to carry a platform-wide setting, so phones use their own
            defaults of 5 stories at 6 seconds each. It is on the list of work the service still
            owes us, and this page will start taking effect the day it lands.
          </p>
        </div>
      </div>

      <TopStoriesForm
        initial={{
          count: settings.count,
          // Entered in seconds, stored in milliseconds. Nobody types 6000.
          dwellSeconds: Math.round(settings.dwellMs / 1000),
          updatedAtIso: settings.updatedAtIso,
          updatedByEmail: settings.updatedByEmail,
        }}
        bounds={{
          count: { min: COUNT_RANGE.min, max: COUNT_RANGE.max },
          dwell: { min: DWELL_SECONDS_RANGE.min, max: DWELL_SECONDS_RANGE.max },
        }}
      />
    </>
  );
}
