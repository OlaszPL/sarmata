'use client';

import { useEffect, useRef, useState } from 'react';
import { AiMark, Button, Field, Notice, PixelLoader, Tag, Textarea } from '@sarmata/ui';
import { pluralPl } from '@/lib/format';
import {
  CONVERSATION_PREP_ANCHOR,
  CONVERSATION_TITLES,
  type ConversationKind,
  type FragmentDecision,
  type PrepFragment,
  type PrepInitial,
  type PrepProgress,
  type PrepRunSnapshot,
  prepSections,
  prepState,
} from './conversation-prep';
import {
  type PrepActionResult,
  decideConversationPrep,
  readConversationPrep,
  startConversationPrep,
} from './conversation-prep-actions';

const POLL_MS = 2000;
const ACTION_FAILED = 'Coś poszło nie tak. Spróbuj ponownie.';

const DESCRIPTIONS: Record<ConversationKind, string> = {
  starting:
    'AI zaproponuje cel, plan i pytania do rozmowy rozpoczynającej na podstawie kryteriów i notatek. Każdy punkt przyjmujesz, poprawiasz albo odrzucasz osobno.',
  evaluation:
    'AI zaproponuje cel, plan, pytania do każdego kryterium i podpowiedzi na trudne sytuacje w rozmowie oceniającej. Każdy punkt przyjmujesz, poprawiasz albo odrzucasz osobno.',
  ongoing:
    'AI zaproponuje cel, plan i pytania do rozmowy bieżącej na podstawie notatek i sygnałów. Każdy punkt przyjmujesz, poprawiasz albo odrzucasz osobno.',
};

interface ConversationPrepPanelProps {
  employeeId: string;
  conversation: ConversationKind;
  /** The case of the starting or evaluation conversation, absent for the ongoing one. */
  evaluationId?: string | undefined;
  /** Criterion id to its name, for the questions per criterion. */
  criterionNames: Record<string, string>;
  initial: PrepInitial;
  headingLevel?: 2 | 3;
  className?: string | undefined;
}

/** Runs a server action, a thrown error (network) reads as a failed action. */
async function call(action: () => Promise<PrepActionResult>): Promise<PrepActionResult> {
  try {
    return await action();
  } catch {
    return { error: ACTION_FAILED };
  }
}

function progressLabel(progress: PrepProgress): string {
  const parts = [
    progress.goal ? 'cel gotowy' : null,
    progress.planSteps > 0
      ? `${progress.planSteps} ${pluralPl(progress.planSteps, 'punkt planu', 'punkty planu', 'punktów planu')}`
      : null,
    progress.criteria > 0
      ? `pytania do ${progress.criteria} ${pluralPl(progress.criteria, 'kryterium', 'kryteriów', 'kryteriów')}`
      : null,
  ].filter(Boolean);
  const done = parts.length > 0 ? ` Gotowe: ${parts.join(', ')}.` : '';
  return `AI przygotowuje rozmowę. Wynik pojawi się tu sam.${done}`;
}

const DECIDED_TAGS: Record<FragmentDecision, string> = {
  accepted: 'Przyjęto',
  edited: 'Poprawiono',
  rejected: 'Odrzucono',
};

function FragmentItem({
  item,
  onDecide,
}: {
  item: PrepFragment;
  onDecide: (
    fragment: string,
    decision: FragmentDecision,
    finalText?: string,
  ) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [changing, setChanging] = useState(false);
  const [text, setText] = useState(item.finalText ?? item.text);
  const fieldId = `prep-edit-${item.fragment.replaceAll('.', '-')}`;

  const decide = async (decision: FragmentDecision, finalText?: string) => {
    if (busy) return;
    if (decision === 'edited' && !finalText) {
      setError('Wpisz poprawioną treść.');
      return;
    }
    setBusy(true);
    const message = await onDecide(item.fragment, decision, finalText);
    setBusy(false);
    setError(message);
    if (message === null) {
      setEditing(false);
      setChanging(false);
    }
  };

  const shown = item.decided === 'edited' && item.finalText ? item.finalText : item.text;
  const showActions = item.decided === null || changing;

  return (
    <div className="flex flex-col gap-2" data-fragment={item.fragment}>
      {editing ? (
        <Field id={fieldId} label="Popraw treść">
          <Textarea
            rows={3}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </Field>
      ) : (
        <p
          className={`max-w-[70ch] leading-[1.45] ${item.decided === 'rejected' ? 'text-ink-muted line-through' : ''}`}
        >
          {shown}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {item.decided !== null && !changing ? (
          <>
            <Tag tone={item.decided === 'rejected' ? 'neutral' : 'done'}>
              {DECIDED_TAGS[item.decided]}
            </Tag>
            <Button
              variant="link"
              onClick={() => {
                setChanging(true);
              }}
            >
              Zmień decyzję
            </Button>
          </>
        ) : null}
        {showActions && editing ? (
          <>
            <Button
              variant="link"
              aria-disabled={busy}
              onClick={() => void decide('edited', text.trim())}
            >
              Zapisz poprawkę
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
            >
              Anuluj
            </Button>
          </>
        ) : null}
        {showActions && !editing ? (
          <>
            <Button variant="link" aria-disabled={busy} onClick={() => void decide('accepted')}>
              Przyjmij
            </Button>
            <Button
              variant="link"
              onClick={() => {
                setEditing(true);
              }}
            >
              Popraw
            </Button>
            <Button variant="link" aria-disabled={busy} onClick={() => void decide('rejected')}>
              Odrzuć
            </Button>
          </>
        ) : null}
      </div>
      {error ? (
        <Notice tone="error" role="alert" className="bg-white">
          <p>{error}</p>
        </Notice>
      ) : null}
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-heading text-ink text-[1.0625rem] leading-[normal] font-semibold">
      {children}
    </p>
  );
}

function DoneView({
  run,
  criterionNames,
  onDecide,
}: {
  run: PrepRunSnapshot;
  criterionNames: Record<string, string>;
  onDecide: (
    fragment: string,
    decision: FragmentDecision,
    finalText?: string,
  ) => Promise<string | null>;
}) {
  const sections = prepSections(run, criterionNames);
  if (sections === null) return null;
  return (
    <div className="flex flex-col gap-5">
      <p className="text-sm leading-[normal] font-semibold">Sugestia AI. Decyzję podejmujesz Ty.</p>
      {sections.open > 0 ? (
        <p className="text-ink-muted text-[0.9375rem]">
          Do przejrzenia: {sections.open} {pluralPl(sections.open, 'punkt', 'punkty', 'punktów')}.
        </p>
      ) : (
        <p className="text-ink-muted text-[0.9375rem]">Wszystkie punkty przejrzane.</p>
      )}
      <div className="flex flex-col gap-2">
        <SubHeading>Cel rozmowy</SubHeading>
        <FragmentItem item={sections.goal} onDecide={onDecide} />
      </div>
      {sections.plan.length > 0 ? (
        <div className="flex flex-col gap-2">
          <SubHeading>Plan rozmowy</SubHeading>
          <ol className="flex list-decimal flex-col gap-3 pl-6">
            {sections.plan.map((item) => (
              <li key={item.fragment}>
                <FragmentItem item={item} onDecide={onDecide} />
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {sections.questions.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SubHeading>Pytania do kryteriów</SubHeading>
          {sections.questions.map((entry) => (
            <div
              key={entry.criterionId}
              className="border-ink flex flex-col gap-2 border-l-[3px] pl-3"
            >
              <p className="font-semibold">{entry.name}</p>
              <ul className="flex flex-col gap-3">
                {entry.items.map((item) => (
                  <li key={item.fragment}>
                    <FragmentItem item={item} onDecide={onDecide} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      ) : null}
      {sections.situations.length > 0 ? (
        <div className="flex flex-col gap-3">
          <SubHeading>Trudne sytuacje</SubHeading>
          <ul className="flex flex-col gap-3">
            {sections.situations.map((item) => (
              <li key={item.fragment} className="flex flex-col gap-1">
                <p className="font-semibold">{item.label}</p>
                <FragmentItem item={item} onDecide={onDecide} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Conversation preparation by the AI (`conversation_prep`): start, progress while the worker writes,
 * failures and the done goal, plan, questions per criterion and hints, each decided on its own with
 * `ai.decide`. Polls the run through a server action, so the page around it is not refreshed.
 */
export function ConversationPrepPanel({
  employeeId,
  conversation,
  evaluationId,
  criterionNames,
  initial,
  headingLevel = 3,
  className,
}: ConversationPrepPanelProps) {
  const [run, setRun] = useState<PrepRunSnapshot | null>(initial.run);
  const [aiEnabled, setAiEnabled] = useState(initial.aiEnabled);
  const [now, setNow] = useState(() => new Date());
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const state = prepState({ aiEnabled, run, now });
  const waitingId = state.kind === 'waiting' && run ? run.id : null;

  useEffect(() => {
    if (waitingId === null) return;
    let cancelled = false;
    const timer = setInterval(() => {
      setNow(new Date());
      if (document.visibilityState === 'hidden') return;
      void call(() => readConversationPrep(waitingId)).then((result) => {
        if (cancelled || !result.run) return;
        setRun(result.run);
        if (result.run.status === 'done') headingRef.current?.focus();
      });
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [waitingId]);

  const start = async () => {
    if (starting) return;
    setStarting(true);
    setError(null);
    const result = await call(() =>
      startConversationPrep({
        employeeId,
        conversation,
        ...(evaluationId ? { evaluationId } : {}),
      }),
    );
    setStarting(false);
    if (result.run) {
      setRun(result.run);
      setNow(new Date());
      return;
    }
    if (result.error?.startsWith('AI jest wyłączone')) setAiEnabled(false);
    setError(result.error ?? ACTION_FAILED);
  };

  const decide = async (
    fragment: string,
    decision: FragmentDecision,
    finalText?: string,
  ): Promise<string | null> => {
    if (!run) return ACTION_FAILED;
    const result = await call(() =>
      decideConversationPrep({
        runId: run.id,
        fragment,
        decision,
        ...(finalText === undefined ? {} : { finalText }),
      }),
    );
    if (result.run) {
      setRun(result.run);
      return null;
    }
    return result.error ?? ACTION_FAILED;
  };

  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  const startButton = (label: string) => (
    <div>
      <Button
        variant="secondary"
        aria-disabled={starting}
        onClick={() => void start()}
        data-testid="conversation-prep-start"
      >
        {starting ? 'Uruchamiam przygotowanie' : label}
      </Button>
    </div>
  );

  return (
    <section
      id={CONVERSATION_PREP_ANCHOR}
      aria-labelledby="conversation-prep-heading"
      data-testid="conversation-prep"
      className={`bg-band flex scroll-mt-6 flex-col items-stretch gap-3 px-6 py-5 sm:px-8 ${className ?? ''}`}
    >
      <Heading
        id="conversation-prep-heading"
        ref={headingRef}
        tabIndex={-1}
        className="font-heading text-ink flex items-center gap-3 text-xl leading-[normal] font-semibold outline-offset-4"
      >
        <AiMark className="size-5 shrink-0" />
        {CONVERSATION_TITLES[conversation]}
      </Heading>
      {state.kind === 'disabled' ? (
        <Notice tone="info" className="bg-white">
          <p>AI jest wyłączone w ustawieniach urzędu. Przygotuj rozmowę samodzielnie.</p>
        </Notice>
      ) : null}
      {state.kind === 'none' ? (
        <>
          <p className="max-w-[70ch] leading-[1.45]">{DESCRIPTIONS[conversation]}</p>
          {startButton('Przygotuj rozmowę z AI')}
        </>
      ) : null}
      {state.kind === 'waiting' ? (
        <div role="status">
          <PixelLoader label={progressLabel(state.progress)} />
        </div>
      ) : null}
      {state.kind === 'timed_out' ? (
        <>
          <Notice tone="warning" className="bg-white">
            <p>Przygotowanie trwa dłużej niż zwykle. Możesz przygotować się bez AI.</p>
          </Notice>
          {startButton('Spróbuj ponownie')}
        </>
      ) : null}
      {state.kind === 'failed' ? (
        <>
          <Notice tone="warning" className="bg-white">
            <p>{state.message}</p>
          </Notice>
          {startButton('Spróbuj ponownie')}
        </>
      ) : null}
      {state.kind === 'deleted' ? (
        <>
          <p>Treść przygotowania usunięto zgodnie z retencją notatek.</p>
          {startButton('Przygotuj rozmowę z AI')}
        </>
      ) : null}
      {state.kind === 'done' ? (
        <>
          <DoneView run={state.run} criterionNames={criterionNames} onDecide={decide} />
          {startButton('Przygotuj od nowa')}
        </>
      ) : null}
      {error ? (
        <Notice tone="error" role="alert" className="bg-white">
          <p>{error}</p>
        </Notice>
      ) : null}
    </section>
  );
}
