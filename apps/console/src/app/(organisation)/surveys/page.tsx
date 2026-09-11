import { ClipboardList, Coins, Users } from 'lucide-react';
import {
  estimateSurveyCost,
  fillRate,
  formatCedis,
  formatRelativeTime,
  isAcceptingResponses,
  planFor,
  type OrganisationAccount,
  type Survey,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { PlanUnavailable } from '@/components/PlanUnavailable';
import { Badge, Button, Panel, load } from '@/components/ui';
import { org } from '@/lib/consoleApi';

/**
 * Paid questions an organisation puts to the public.
 *
 * The other half of the product: reports answer "what happened", surveys answer
 * "what is it like there" — the question no incident ever gets filed about.
 *
 * Cost is shown against the full response target rather than against responses
 * received, because that is what is committed the moment a survey goes live.
 * Showing spend-so-far would understate the liability and surprise someone at
 * the end of the month.
 */
export default async function Page() {
  /*
   * This organisation's own surveys, from the server.
   *
   * `/org/surveys` is already scoped to the caller, so there is no client-side
   * filter by organisation id — and no chance of showing one organisation the
   * questions another is paying for.
   */
  const result = await load(async () => ({
    organisation: await org.current<OrganisationAccount>(),
    surveys: await org.surveys<Survey>(),
  }));

  if (!result.ok) {
    return (
      <>
        <PageHeader eyebrow="Surveys" title="Paid questions" />
        <OrganisationOutage error={result.error} retryHref="/surveys" />
      </>
    );
  }

  const { organisation, surveys: mine } = result.data;
  const plan = planFor(organisation.tier);
  // The page states how many concurrent surveys the plan allows, which is a
  // number that has to be right or it is an invitation to break a limit.
  if (!plan) return <PlanUnavailable what="how many surveys your plan allows" />;
  const live = mine.filter((s) => isAcceptingResponses(s));

  return (
    <>
      <PageHeader
        eyebrow="Surveys"
        title="Paid questions"
        description={`${live.length} of ${plan.concurrentSurveys} allowed running at once.`}
        actions={
          <Button size="sm" disabled={live.length >= plan.concurrentSurveys}>
            <ClipboardList className="h-3.5 w-3.5" /> New survey
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-3 px-7 py-6">
          {plan.concurrentSurveys === 0 ? (
            <Panel className="p-8 text-center">
              <p className="text-sm font-medium">Surveys are not on your plan</p>
              <p className="mt-1 text-xs text-text-muted">
                Upgrade to ask the public questions directly.
              </p>
            </Panel>
          ) : mine.length === 0 ? (
            <Panel className="p-10 text-center">
              <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-md bg-canvas-raise">
                <ClipboardList className="h-4.5 w-4.5 text-text-muted" strokeWidth={1.8} />
              </div>
              <p className="mt-3 text-sm font-medium">No surveys yet</p>
              <p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-text-muted">
                Ask people in a specific area a few questions. They are paid on completion, and you
                commit the full cost when it goes live.
              </p>
            </Panel>
          ) : (
            mine.map((survey) => {
              const cost = estimateSurveyCost(survey.rewardPesewas, survey.responsesTarget);
              const filled = fillRate(survey);
              const accepting = isAcceptingResponses(survey);

              return (
                <Panel key={survey.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{survey.title}</h2>
                        <Badge tone={accepting ? 'success' : 'neutral'}>
                          {accepting ? 'Live' : survey.status}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-text-muted">
                        {survey.description}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="tabular text-sm font-semibold">
                        {formatCedis(cost.totalPesewas)}
                      </p>
                      <p className="text-2xs text-text-faint">committed</p>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-2xs text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        {survey.responsesReceived} of {survey.responsesTarget} responses
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Coins className="h-3 w-3" />
                        {formatCedis(survey.rewardPesewas)} each
                      </span>
                    </div>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-canvas-raise">
                      <div
                        className="h-full rounded-pill bg-accent"
                        style={{ width: `${Math.round(filled * 100)}%` }}
                      />
                    </div>
                  </div>

                  <p className="mt-3 border-t border-hairline/[0.07] pt-3 text-2xs text-text-faint">
                    {survey.questions.length} questions ·{' '}
                    {survey.targetArea ? 'targeted by area' : 'anywhere in Ghana'} · closes{' '}
                    {formatRelativeTime(survey.closesAtIso) ?? 'soon'}
                  </p>
                </Panel>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
