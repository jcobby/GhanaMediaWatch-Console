import { redirect } from 'next/navigation';
import { ClipboardList, Coins, Users } from 'lucide-react';
import {
  estimateSurveyCost,
  fillRate,
  formatCedis,
  formatRelativeTime,
  planFor,
  roleCan,
  type OrganisationAccount,
} from '@dawuro/core';
import { PageHeader } from '@/components/shell';
import { OrganisationOutage } from '@/components/OrganisationOutage';
import { PlanUnavailable } from '@/components/PlanUnavailable';
import { Badge, Button, Panel, load } from '@/components/ui';
import { org } from '@/lib/consoleApi';
import { requireSession } from '@/lib/session';
import { normaliseSurvey } from '@/lib/surveys';
import { SurveyActions } from './SurveyActions';

/**
 * Paid questions an organisation puts to the public.
 *
 * The other half of the product: reports answer "what happened", surveys answer
 * "what is it like there" — the question no incident ever gets filed about.
 *
 * Cost is shown against the full response target rather than against responses
 * received, because that is what is committed the moment a survey goes live.
 */
export default async function Page() {
  /*
   * The sidebar has always gated this on `manage_surveys`; nothing else did.
   *
   * So the link was hidden from roles without the capability and the page was
   * served to them anyway the moment they typed the URL — a menu entry standing
   * in for a permission check. Surveys commit real money (reward × target is
   * charged when one goes live), so the capability is now enforced where it is
   * exercised.
   *
   * Only enforced when the account has a role: see the note on the inbox page.
   */
  const session = await requireSession();
  if (session.role && !roleCan(session.role, 'manage_surveys')) redirect('/');

  /*
   * This organisation's own surveys, from the server, normalised — the list
   * endpoint sends a summary without questions, reward or target.
   */
  const result = await load(async () => ({
    organisation: await org.current<OrganisationAccount>(),
    surveys: (await org.surveys<unknown>()).map((survey) => normaliseSurvey(survey)),
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
  const live = mine.filter((s) => s.accepting);

  return (
    <>
      <PageHeader
        eyebrow="Surveys"
        title="Paid questions"
        description={`${live.length} of ${plan.concurrentSurveys} allowed running at once. Setting one up from here is not ready yet: a survey's reward and its response target cannot be stored with it, and those two decide what it costs you.`}
        actions={
          /*
            Disabled, and the reason is on the page rather than hidden.

            The control was live and did nothing — no form behind it, nowhere to
            go. Building the form is not the missing piece either: a survey can
            be created with a title, a description and its questions, but the
            reward per response and the response target are dropped. Those two
            are the entire cost of a survey, and a form that takes them and
            quietly loses them is worse than a button that admits it is not
            ready. Tracked as item R in BACKEND-REQUESTS.md.
          */
          <Button size="sm" disabled>
            <ClipboardList className="h-3.5 w-3.5" /> New survey
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-3 px-4 py-6 sm:px-7">
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
              const cost = survey.hasCost
                ? estimateSurveyCost(survey.rewardPesewas, survey.responsesTarget)
                : null;
              const closes = survey.closesAtIso ? formatRelativeTime(survey.closesAtIso) : null;
              const details = [
                survey.questions.length > 0 ? `${survey.questions.length} questions` : null,
                closes ? `${survey.accepting ? 'closes' : 'closed'} ${closes}` : null,
              ].filter(Boolean);

              return (
                <Panel key={survey.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-sm font-semibold">{survey.title}</h2>
                        <Badge tone={survey.accepting ? 'success' : 'neutral'}>
                          {survey.accepting ? 'Live' : survey.status === 'closed' ? 'Closed' : 'Not open'}
                        </Badge>
                      </div>
                      {survey.description ? (
                        <p className="mt-1 text-xs leading-relaxed text-text-muted">
                          {survey.description}
                        </p>
                      ) : null}
                    </div>
                    {cost ? (
                      <div className="shrink-0 text-right">
                        <p className="tabular text-sm font-semibold">
                          {formatCedis(cost.totalPesewas)}
                        </p>
                        <p className="text-2xs text-text-faint">committed</p>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-2xs text-text-muted">
                      <span className="flex items-center gap-1.5">
                        <Users className="h-3 w-3" />
                        {survey.responsesTarget > 0
                          ? `${survey.responsesReceived} of ${survey.responsesTarget} responses`
                          : `${survey.responsesReceived} ${survey.responsesReceived === 1 ? 'response' : 'responses'}`}
                      </span>
                      {survey.rewardPesewas > 0 ? (
                        <span className="flex items-center gap-1.5">
                          <Coins className="h-3 w-3" />
                          {formatCedis(survey.rewardPesewas)} each
                        </span>
                      ) : null}
                    </div>
                    {survey.responsesTarget > 0 ? (
                      <div className="mt-1.5 h-1 overflow-hidden rounded-pill bg-canvas-raise">
                        <div
                          className="h-full rounded-pill bg-accent"
                          style={{ width: `${Math.round(fillRate(survey) * 100)}%` }}
                        />
                      </div>
                    ) : null}
                  </div>

                  {details.length > 0 ? (
                    <p className="mt-3 text-2xs text-text-faint">{details.join(' · ')}</p>
                  ) : null}

                  <SurveyActions surveyId={survey.id} accepting={survey.accepting} />
                </Panel>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
