import type { Survey } from '@dawuro/core';

/**
 * Surveys and their results, as the service sends them.
 *
 * **`GET /org/surveys` returns a summary, not a survey.** Its items are
 * `{id, title, status, closesAtIso, responsesReceived}`. The page read them as
 * the full `Survey` type and called `survey.questions.length` — which throws on
 * the first survey an organisation creates. And the service's statuses are
 * `open | closed`, where the console's are `draft | live | closed`, so a running
 * survey never showed as live.
 *
 * Figures the summary does not carry (reward, target) are zero here, and
 * `hasCost` says whether the committed cost can be shown at all — it is left off
 * rather than printed as ₵0.00.
 */

export interface SurveyView extends Survey {
  accepting: boolean;
  hasCost: boolean;
}

export interface OptionCount {
  label: string;
  count: number;
}

export interface QuestionResult {
  id: string;
  label: string;
  options: OptionCount[];
  average: number | null;
  answered: number | null;
}

export interface SurveyResults {
  total: number | null;
  questions: QuestionResult[];
}

type Loose = Record<string, unknown>;

const isRecord = (value: unknown): value is Loose =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const text = (value: unknown): string | null =>
  typeof value === 'string' && value ? value : null;

const count = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;

function statusOf(value: unknown): Survey['status'] {
  if (value === 'live' || value === 'open' || value === 'active') return 'live';
  if (value === 'closed' || value === 'ended') return 'closed';
  return 'draft';
}

export function normaliseSurvey(raw: unknown, now: number = Date.now()): SurveyView {
  const source: Loose = isRecord(raw) ? raw : {};
  const status = statusOf(source.status);
  const rewardPesewas = count(source.rewardPesewas) ?? 0;
  const responsesTarget = count(source.responsesTarget) ?? 0;
  const responsesReceived = count(source.responsesReceived) ?? 0;
  const closesAtIso = text(source.closesAtIso) ?? text(source.closesAt) ?? '';
  const closes = closesAtIso ? Date.parse(closesAtIso) : Number.NaN;

  return {
    id: text(source.id) ?? '',
    businessId: text(source.orgId) ?? text(source.businessId) ?? '',
    businessName: text(source.businessName) ?? '',
    title: text(source.title) ?? 'Untitled survey',
    description: text(source.description) ?? '',
    questions: Array.isArray(source.questions) ? (source.questions as Survey['questions']) : [],
    rewardPesewas,
    targetArea: null,
    responsesTarget,
    responsesReceived,
    closesAtIso,
    status,
    accepting:
      status === 'live' &&
      (responsesTarget === 0 || responsesReceived < responsesTarget) &&
      (!Number.isFinite(closes) || closes > now),
    hasCost: rewardPesewas > 0 && responsesTarget > 0,
  };
}

/**
 * Per-question results.
 *
 * `aggregates` is typed as "any object", so each of the common ways of writing
 * a count is read: a `counts` map of answer to number, or a list of
 * `{label | value | option, count}`. A question with neither still appears, with
 * how many answered it if that is known.
 */
export function normaliseResults(raw: unknown): SurveyResults {
  const source: Loose = isRecord(raw) ? raw : {};
  const aggregates = Array.isArray(source.aggregates) ? source.aggregates.filter(isRecord) : [];

  const questions = aggregates.map((aggregate, index): QuestionResult => {
    let options: OptionCount[] = [];
    if (isRecord(aggregate.counts)) {
      options = Object.entries(aggregate.counts).flatMap(([label, n]) => {
        const c = count(n);
        return c === null ? [] : [{ label, count: c }];
      });
    } else {
      const list = [aggregate.options, aggregate.choices, aggregate.breakdown].find(Array.isArray);
      options = ((list as unknown[] | undefined) ?? []).filter(isRecord).flatMap((option) => {
        const label = text(option.label) ?? text(option.value) ?? text(option.option) ?? text(option.answer);
        const c = count(option.count) ?? count(option.responses) ?? count(option.total);
        return label && c !== null ? [{ label, count: c }] : [];
      });
    }

    const average =
      typeof aggregate.average === 'number' && Number.isFinite(aggregate.average)
        ? aggregate.average
        : typeof aggregate.mean === 'number' && Number.isFinite(aggregate.mean)
          ? aggregate.mean
          : null;

    return {
      id: text(aggregate.questionId) ?? text(aggregate.id) ?? `question-${index}`,
      label:
        text(aggregate.prompt) ??
        text(aggregate.question) ??
        text(aggregate.label) ??
        text(aggregate.title) ??
        `Question ${index + 1}`,
      options: options.sort((a, b) => b.count - a.count),
      average,
      answered:
        count(aggregate.answered) ?? count(aggregate.responses) ?? count(aggregate.total) ?? count(aggregate.count),
    };
  });

  return { total: count(source.total), questions };
}
