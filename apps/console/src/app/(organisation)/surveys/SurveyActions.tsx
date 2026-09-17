'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart3, Square } from 'lucide-react';
import { Button } from '@/components/ui';
import type { SurveyResults } from '@/lib/surveys';

/**
 * Results and closing, for one survey.
 *
 * Results are read when asked for rather than for every survey on page load —
 * each is a separate request, and most visits to this page are to check one.
 * Closing asks once more, because a closed survey cannot take the answers it was
 * paying for.
 */
export function SurveyActions({ surveyId, accepting }: { surveyId: string; accepting: boolean }) {
  const router = useRouter();
  const [results, setResults] = useState<SurveyResults | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmClose, setConfirmClose] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  const url = `/api/org/surveys/${encodeURIComponent(surveyId)}`;

  const toggleResults = async () => {
    if (open) {
      setOpen(false);
      return;
    }
    setOpen(true);
    if (results) return;
    setLoading(true);
    setFailure(null);
    try {
      const res = await fetch(url);
      const answer = (await res.json().catch(() => null)) as
        | { results?: SurveyResults; error?: string }
        | null;
      if (!res.ok || !answer?.results) {
        setFailure(answer?.error ?? 'Results could not be read just now.');
        return;
      }
      setResults(answer.results);
    } catch {
      setFailure('Results could not be read just now.');
    } finally {
      setLoading(false);
    }
  };

  const close = async () => {
    setClosing(true);
    setFailure(null);
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'close' }),
      });
      const answer = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setFailure(answer?.error ?? 'The survey could not be closed.');
        return;
      }
      setClosed(true);
      setConfirmClose(false);
      router.refresh();
    } catch {
      setFailure('The console could not reach its own server. The survey is still open.');
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="mt-3 border-t border-hairline/[0.07] pt-3">
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" variant="ghost" loading={loading} onClick={() => void toggleResults()}>
          <BarChart3 className="h-3.5 w-3.5" /> {open ? 'Hide results' : 'See results'}
        </Button>
        {accepting && !closed ? (
          confirmClose ? (
            <>
              <span className="text-2xs text-text-muted">Stop taking answers?</span>
              <Button size="sm" variant="ghost" disabled={closing} onClick={() => setConfirmClose(false)}>
                Keep open
              </Button>
              <Button size="sm" variant="danger" loading={closing} onClick={() => void close()}>
                Close survey
              </Button>
            </>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => setConfirmClose(true)}>
              <Square className="h-3 w-3" /> Close survey
            </Button>
          )
        ) : null}
        {closed ? <span className="text-2xs text-text-muted">Closed. No more answers are taken.</span> : null}
      </div>

      {failure ? (
        <p role="alert" className="mt-2 text-right text-xs text-danger">
          {failure}
        </p>
      ) : null}

      {open && results ? (
        <div className="mt-3 space-y-4">
          {results.total !== null ? (
            <p className="text-2xs text-text-muted">
              {results.total} {results.total === 1 ? 'response' : 'responses'} in total
            </p>
          ) : null}
          {results.questions.length === 0 ? (
            <p className="text-xs text-text-muted">No answers to count yet.</p>
          ) : (
            results.questions.map((question) => {
              const max = Math.max(1, ...question.options.map((o) => o.count));
              return (
                <div key={question.id}>
                  <p className="text-xs font-medium text-text-primary">{question.label}</p>
                  <p className="text-2xs text-text-faint">
                    {question.answered !== null ? `${question.answered} answered` : null}
                    {question.average !== null
                      ? `${question.answered !== null ? ' · ' : ''}average ${question.average.toFixed(1)}`
                      : null}
                  </p>
                  {question.options.length > 0 ? (
                    <ul className="mt-1.5 space-y-1">
                      {question.options.map((option) => (
                        <li key={option.label} className="flex items-center gap-2 text-2xs">
                          <span className="w-32 shrink-0 truncate text-text-secondary sm:w-44">
                            {option.label}
                          </span>
                          <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-pill bg-canvas-raise">
                            <span
                              className="block h-full rounded-pill bg-accent"
                              style={{ width: `${Math.round((option.count / max) * 100)}%` }}
                            />
                          </span>
                          <span className="tabular w-8 shrink-0 text-right text-text-muted">
                            {option.count}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
