import { AiMark, Button, Notice, PixelLoader } from '@sarmata/ui';
import { PollingRefresh } from '@/components/polling-refresh';
import {
  DRAFT_TIMEOUT_MS,
  type SheetDraftState,
  draftProposals,
} from '@/lib/evaluations/sheet-draft';
import { pluralPl } from '@/lib/format';
import { StartDraftForm } from './start-draft-form';

export const AI_PANEL_TITLE_ID = 'ai-panel-title';

function Band({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-rule bg-band flex flex-col gap-3 border-b px-6 py-5 sm:px-8">
      {children}
    </div>
  );
}

function PanelTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3
      id={AI_PANEL_TITLE_ID}
      tabIndex={-1}
      className="font-heading text-ink flex items-center gap-3 text-xl leading-[normal] font-semibold outline-offset-4"
    >
      <AiMark className="size-5 shrink-0" />
      {children}
    </h3>
  );
}

function Questions({ questions }: { questions: string[] }) {
  if (questions.length === 0) return null;
  return (
    <div className="flex flex-col gap-1">
      <p className="font-heading font-semibold">Pytania do rozmowy</p>
      <ul className="flex max-w-[70ch] list-disc flex-col gap-1 pl-5">
        {questions.map((question) => (
          <li key={question}>{question}</li>
        ))}
      </ul>
    </div>
  );
}

/** The band of the AI draft above the criteria: start, progress, failures and the summary of a done run. */
export function AiDraftPanel({
  id,
  state,
  criterionNames,
}: {
  id: string;
  state: SheetDraftState;
  /** Criterion id to its name for the criteria of the case: the progress line and the open count. */
  criterionNames: Record<string, string>;
}) {
  switch (state.kind) {
    case 'disabled':
      return (
        <Band>
          <Notice tone="info">
            <p>AI jest wyłączone w ustawieniach urzędu. Wypełnij arkusz samodzielnie.</p>
          </Notice>
        </Band>
      );
    case 'none':
      return (
        <Band>
          <PanelTitle>Szkic AI</PanelTitle>
          <p className="max-w-[70ch]">
            AI przygotuje propozycje ocen i zdań na podstawie notatek. Każdą przyjmujesz albo
            odrzucasz osobno.
          </p>
          <StartDraftForm id={id} label="Przygotuj szkic AI" />
        </Band>
      );
    case 'waiting': {
      const names = state.finished.map((criterionId) => criterionNames[criterionId] ?? criterionId);
      return (
        <Band>
          <PanelTitle>Szkic AI</PanelTitle>
          <PixelLoader
            label={`AI przygotowuje szkic. Gotowe kryteria: ${state.finished.length} z ${Object.keys(criterionNames).length}.`}
          />
          {names.length > 0 ? <p className="text-ink-muted">{names.join(', ')}</p> : null}
          <PollingRefresh
            active
            intervalMs={2000}
            maxMs={DRAFT_TIMEOUT_MS}
            timeoutMessage="Szkic powstaje dłużej niż zwykle. Możesz pracować dalej bez AI."
          />
        </Band>
      );
    }
    case 'timed_out':
      return (
        <Band>
          <PanelTitle>Szkic AI</PanelTitle>
          <Notice tone="warning">
            <p>Szkic powstaje dłużej niż zwykle. Możesz pracować dalej bez AI.</p>
          </Notice>
          <StartDraftForm id={id} label="Spróbuj ponownie" />
        </Band>
      );
    case 'failed':
      return (
        <Band>
          <PanelTitle>Szkic AI</PanelTitle>
          <Notice tone="warning">
            <p>{state.message}</p>
          </Notice>
          <StartDraftForm id={id} label="Spróbuj ponownie" />
        </Band>
      );
    case 'deleted':
      return (
        <Band>
          <PanelTitle>Szkic AI</PanelTitle>
          <p>Treść szkicu usunięto zgodnie z retencją notatek.</p>
        </Band>
      );
    case 'insufficient_data':
      return (
        <Band>
          <PanelTitle>Szkic AI</PanelTitle>
          <p>Za mało notatek, żeby AI coś zaproponowało.</p>
          <Questions questions={state.questions} />
        </Band>
      );
    case 'done': {
      const { open, questions } = draftProposals(state.run, Object.keys(criterionNames));
      return (
        <Band>
          <PanelTitle>
            {open === 0
              ? 'Wszystkie propozycje przejrzane'
              : `Szkic AI jest gotowy: ${open} ${pluralPl(open, 'propozycja', 'propozycje', 'propozycji')} do przejrzenia`}
          </PanelTitle>
          {open > 0 ? (
            <div>
              <Button asChild variant="secondary">
                <a href="#ai-proposals">Przejrzyj propozycje</a>
              </Button>
            </div>
          ) : null}
          <Questions questions={questions} />
        </Band>
      );
    }
  }
}
