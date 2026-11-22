import { AiSuggestion, Button, Notice, PixelLoader, Tag } from '@sarmata/ui';
import { decideAnswer } from '@/app/(app)/pomoc/actions';
import { PollingRefresh } from '@/components/polling-refresh';
import { QUESTION_TIMEOUT_MS, type QuestionState } from '@/lib/help/question';

interface AnswerProps {
  runId: string;
  question: string;
  state: QuestionState;
  /** Evaluator and hr decide about the answer, the admin only reads. */
  canDecide: boolean;
}

const TIMEOUT_MESSAGE =
  'Asystent odpowiada dłużej niż zwykle. Odśwież stronę później albo skorzystaj z instrukcji.';

function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter((part) => part !== '');
}

function DecisionForm({
  runId,
  question,
  decision,
  variant,
  children,
}: {
  runId: string;
  question: string;
  decision: 'accepted' | 'rejected';
  variant: 'secondary' | 'link';
  children: string;
}) {
  return (
    <form action={decideAnswer}>
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="question" value={question} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" variant={variant}>
        {children}
      </Button>
    </form>
  );
}

function Body({ runId, question, state, canDecide }: AnswerProps) {
  switch (state.kind) {
    case 'waiting':
      return (
        <>
          <PixelLoader label="Asystent szuka odpowiedzi w przepisach." />
          <PollingRefresh
            active
            intervalMs={2000}
            maxMs={QUESTION_TIMEOUT_MS}
            timeoutMessage={TIMEOUT_MESSAGE}
          />
        </>
      );
    case 'timed_out':
      return (
        <Notice tone="warning">
          <p>{TIMEOUT_MESSAGE}</p>
        </Notice>
      );
    case 'failed':
      return (
        <Notice tone="warning">
          <p>{state.message}</p>
        </Notice>
      );
    case 'deleted':
      return (
        <Notice tone="info">
          <p>Treść tej odpowiedzi usunięto zgodnie z okresem przechowywania.</p>
        </Notice>
      );
    case 'done':
      return (
        <div className="grid gap-4">
          <AiSuggestion
            title="Odpowiedź asystenta"
            sources={
              state.sources.length > 0 ? (
                <section aria-labelledby="zrodla" className="grid gap-2">
                  <h4 id="zrodla" className="font-heading text-ink text-base font-semibold">
                    Źródła
                  </h4>
                  <ol className="grid gap-3">
                    {state.sources.map((source) => (
                      <li key={source.number} className="grid gap-1">
                        <p>
                          <span className="font-heading text-ink font-semibold">
                            [{source.number}] {source.reference}
                          </span>
                          {', '}
                          {source.title}, {source.citation}
                        </p>
                        <details>
                          <summary className="text-link cursor-pointer underline">
                            Pokaż fragment przepisu
                          </summary>
                          <blockquote className="border-ink mt-2 max-w-[70ch] border-l-[3px] pl-3">
                            {source.heading ? (
                              <p className="font-heading text-ink font-semibold">
                                {source.heading}
                              </p>
                            ) : null}
                            <p className="whitespace-pre-line">{source.text}</p>
                          </blockquote>
                        </details>
                      </li>
                    ))}
                  </ol>
                </section>
              ) : null
            }
            actions={
              state.decided === null ? (
                canDecide ? (
                  <>
                    <DecisionForm
                      runId={runId}
                      question={question}
                      decision="accepted"
                      variant="secondary"
                    >
                      Odpowiedź pomogła
                    </DecisionForm>
                    <DecisionForm
                      runId={runId}
                      question={question}
                      decision="rejected"
                      variant="link"
                    >
                      Odpowiedź nie pomogła
                    </DecisionForm>
                  </>
                ) : null
              ) : (
                <Tag tone="neutral">
                  {state.decided === 'accepted'
                    ? 'Oceniono jako pomocną'
                    : 'Oceniono jako niepomocną'}
                </Tag>
              )
            }
          >
            <div className="grid max-w-[70ch] gap-3">
              {paragraphs(state.answer).map((part, index) => (
                <p key={index}>{part}</p>
              ))}
            </div>
          </AiSuggestion>
          {state.grounded ? null : (
            <Notice tone="warning">
              <p>Ta odpowiedź nie opiera się na cytowanych przepisach. Sprawdź ją w kadrach.</p>
            </Notice>
          )}
        </div>
      );
  }
}

/** The answer of the procedure assistant for one question, below the form. */
export function Answer(props: AnswerProps) {
  return (
    <section aria-labelledby="odpowiedz" className="grid gap-4">
      <h3
        id="odpowiedz"
        tabIndex={-1}
        className="font-heading text-ink text-xl leading-[normal] font-semibold"
      >
        Odpowiedź asystenta
      </h3>
      {props.question ? <p className="max-w-[70ch]">Twoje pytanie: „{props.question}”</p> : null}
      <Body {...props} />
    </section>
  );
}
