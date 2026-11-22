'use client';

import {
  type SubmitEvent,
  type ReactNode,
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { flushSync } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, CircleCheck, LoaderCircle, TriangleAlert } from 'lucide-react';
import {
  Button,
  DateInput,
  ErrorSummary,
  Field,
  FieldError,
  Notice,
  ScaleChoice,
  Section,
  Textarea,
} from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { createAutosave } from '@/lib/evaluations/sheet-autosave';
import {
  type RatingProposal,
  type SentenceProposal,
  appendSentence,
  decidedText,
} from '@/lib/evaluations/sheet-draft';
import { type PartTwoPatch, partTwoDrift } from '@/lib/evaluations/sheet-form';
import { type GateLink, fieldErrorLinks, gateTitle } from '@/lib/evaluations/sheet-gates';
import { routes } from '@/lib/routes';
import {
  type SaveResult,
  type SheetFormState,
  decideFragment,
  saveSheet,
  saveSheetAndCheck,
} from '../actions';
import { AI_PANEL_TITLE_ID } from './ai-draft-panel';
import {
  DecidedLine,
  type DecideFn,
  type Decision,
  RatingSuggestion,
  SentenceSuggestion,
} from './ai-proposals';
import { DevelopmentHints, type DevelopmentRecommendation } from './development-hints';
import { QualityCheck } from './quality-check';
import { PendingSubmit, SheetSaveProvider } from './sheet-save-context';

/** Pause after the last change before the sheet is saved. */
const AUTOSAVE_DELAY_MS = 1500;

/** Id of the sheet form. The date inputs sit above the AI band, outside the form element. */
const FORM_ID = 'sheet-form';

const CONCLUSIONS_FIELD_ERROR = 'Wpisz wnioski do IPRZ. Bez nich nie zatwierdzisz oceny.';
const SAVE_FAILED = 'Nie udało się zapisać. Spróbuj ponownie.';

interface Criterion {
  id: string;
  name: string;
  mandatory: boolean;
  indicators: string[];
}

export interface SheetEditorProps {
  id: string;
  criteria: Criterion[];
  scale: { value: number; label: string; name: string }[];
  initial: PartTwoPatch;
  mode: 'period' | 'edit';
  /** Gates still open on the saved sheet, shown in the banner above the section. */
  issues: GateLink[];
  hints: DevelopmentRecommendation | null;
  /** AI proposals of the newest done draft run, shown in the criterion blocks and before the text fields. */
  draft?:
    { ratings: RatingProposal[]; sentences: SentenceProposal[]; runId: string } | null | undefined;
  /** Note id to the date of the note, for the sources of AI proposals. */
  noteDates: Record<string, string>;
  /** Points that make an evaluation negative, null when the rules have none. */
  negativePoints: number | null;
  /** Content above the form inside the section, e.g. the interview form. */
  before?: ReactNode;
  /**
   * Content between the dates and the criteria, the place of the AI draft panel. It has a form of
   * its own, so it renders outside the sheet form.
   */
  aiPanel?: ReactNode;
}

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };

function SaveStatusLine({ status, onRetry }: { status: SaveStatus; onRetry: () => void }) {
  return (
    <div role="status" className="text-ink-muted flex items-center gap-2 text-[0.9375rem]">
      {status.kind === 'saving' ? (
        <>
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          <span>Zapisuję zmiany</span>
        </>
      ) : null}
      {status.kind === 'saved' ? (
        <>
          <CircleCheck className="size-4" aria-hidden />
          <span>Zapisano o {status.at}</span>
        </>
      ) : null}
      {status.kind === 'error' ? (
        <>
          <TriangleAlert className="text-error size-4" aria-hidden />
          <span className="text-ink">
            {status.message}
            <Button variant="link" onClick={onRetry} className="ml-2">
              Zapisz teraz
            </Button>
          </span>
        </>
      ) : null}
    </div>
  );
}

export function SheetEditor({
  id,
  criteria,
  scale,
  initial,
  mode,
  issues: initialIssues,
  hints,
  negativePoints,
  draft,
  noteDates,
  before,
  aiPanel,
}: SheetEditorProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);
  /** The save running now, including the saves queued behind it. */
  const savePromise = useRef<Promise<void> | null>(null);
  /** The fields as of the last change or render, for a save after the form left the page. */
  const snapshot = useRef<FormData | null>(null);

  /**
   * The posted fields: read from the form while it is on the page (the dates join it through the
   * `form` attribute, which only works while connected), otherwise the last snapshot.
   */
  const currentFields = useCallback((): FormData | null => {
    const form = formRef.current;
    if (form?.isConnected) return new FormData(form);
    return snapshot.current;
  }, []);
  const takeSnapshot = useCallback(() => {
    const form = formRef.current;
    if (form?.isConnected) snapshot.current = new FormData(form);
  }, []);
  // After every render the DOM shows the state, e.g. a rating accepted from the AI.
  useLayoutEffect(() => {
    takeSnapshot();
  });

  const [ratings, setRatings] = useState<Record<string, number>>(initial.ratings);
  const [justification, setJustification] = useState(initial.justification);
  const [conclusions, setConclusions] = useState(initial.developmentConclusions);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  // The banner follows the last save, and the server's view whenever the page brings new gates
  // (e.g. after the interview is recorded, the editor stays mounted with the gates of `interview`).
  const [issues, setIssues] = useState(initialIssues);
  const [issuesProp, setIssuesProp] = useState(initialIssues);
  if (initialIssues !== issuesProp) {
    setIssuesProp(initialIssues);
    setIssues(initialIssues);
  }

  // The interview form unmounts with its focused button when it succeeds: say so and take focus.
  const [modeProp, setModeProp] = useState(mode);
  const [interviewRecorded, setInterviewRecorded] = useState(false);
  if (mode !== modeProp) {
    setModeProp(mode);
    setInterviewRecorded(modeProp === 'period' && mode === 'edit');
  }
  const recordedRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (interviewRecorded) recordedRef.current?.focus();
  }, [interviewRecorded]);

  const [state, formAction, submitting] = useActionState<SheetFormState, FormData>(
    saveSheetAndCheck.bind(null, id),
    { values: {}, fieldErrors: {} },
  );
  const submitErrors = fieldErrorLinks(id, state.fieldErrors, 'czesc-2');
  useErrorTitle(submitErrors.length > 0 || state.formError !== undefined);

  // "Zapisz szkic" saved: the status line shows the time as after an autosave.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state.savedAt !== undefined) setStatus({ kind: 'saved', at: state.savedAt });
  }

  /** Saves the sheet. A call during a save queues one more and resolves with the running save. */
  const run = useCallback((): Promise<void> => {
    if (inFlight.current) {
      queued.current = true;
      return savePromise.current ?? Promise.resolve();
    }
    if (currentFields() === null) return Promise.resolve();
    inFlight.current = true;
    setStatus({ kind: 'saving' });
    const takeQueued = () => {
      const wasQueued = queued.current;
      queued.current = false;
      return wasQueued;
    };
    const saving = (async () => {
      try {
        let result: SaveResult = { ok: false, issues: [] };
        let fields = currentFields();
        while (fields !== null) {
          result = await saveSheet(id, fields);
          fields = takeQueued() && result.ok ? currentFields() : null;
        }
        if (result.ok) {
          setStatus({ kind: 'saved', at: result.savedAt ?? '' });
          setIssues(result.issues);
          router.refresh();
        } else {
          setStatus({ kind: 'error', message: result.formError ?? SAVE_FAILED });
        }
      } catch {
        setStatus({ kind: 'error', message: SAVE_FAILED });
      } finally {
        inFlight.current = false;
        savePromise.current = null;
      }
    })();
    savePromise.current = saving;
    return saving;
  }, [currentFields, id, router]);

  const runRef = useRef(run);
  useEffect(() => {
    runRef.current = run;
  }, [run]);
  const [autosave] = useState(() =>
    createAutosave(() => {
      void runRef.current();
    }, AUTOSAVE_DELAY_MS),
  );
  const schedule = useCallback(() => {
    takeSnapshot();
    autosave.schedule();
  }, [autosave, takeSnapshot]);

  /**
   * Stores a change that waits for the pause, or waits for the save that runs. Every other submit
   * on part II (interview, AI start, AI decisions) calls it first.
   */
  const flush = useCallback(async () => {
    if (autosave.takePending()) await runRef.current();
    else if (savePromise.current !== null) await savePromise.current;
  }, [autosave]);

  // A fast typist on a slow machine can fill the controls before React hydrates them, and React
  // then may never see a change. Once hydrated, take over what the controls hold and save it, so the
  // state (and the next render) does not fall back to the server values.
  const hydrationChecked = useRef(false);
  useEffect(() => {
    if (hydrationChecked.current) return;
    hydrationChecked.current = true;
    const form = formRef.current;
    if (form === null) return;
    const drift = partTwoDrift(
      new FormData(form),
      criteria.map((criterion) => criterion.id),
      initial,
    );
    if (drift === null) return;
    const { ratings: typedRatings, justification: typedJustification } = drift;
    const typedConclusions = drift.developmentConclusions;
    if (typedRatings !== undefined) setRatings(typedRatings);
    if (typedJustification !== undefined) setJustification(typedJustification);
    if (typedConclusions !== undefined) setConclusions(typedConclusions);
    autosave.schedule();
  }, [autosave, criteria, initial]);

  // Leaving the page (a tab, the sidebar, the back link) must not drop a change that waits for the
  // pause. The form may already be detached here, so the snapshot of the last change stands in.
  // React also runs this cleanup when a Suspense boundary only hides the editor for a moment, so it
  // takes the usual save path: the status line and the gate banner then follow the save.
  useLayoutEffect(
    () => () => {
      if (autosave.takePending()) void runRef.current();
    },
    [autosave],
  );

  /**
   * React resets a form after its action. That unchecks the controlled rating tiles (their
   * `defaultChecked` is the value at mount) while the state keeps the new ratings, so the next
   * autosave would drop them. Dispatching the action here skips the reset. Without JavaScript the
   * form still posts through `action`.
   */
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submitting) return;
    // The submit saves the same fields as the scheduled autosave.
    autosave.takePending();
    const formData = new FormData(event.currentTarget);
    startTransition(() => {
      formAction(formData);
    });
  };

  // On load only the conclusions field repeats its gate (mockup), the others stay in the banner.
  // After a submit the submitted errors show at their fields.
  const conclusionsGate =
    mode === 'edit' &&
    issues.some((item) => item.href === undefined && item.fieldId === 'developmentConclusions');
  const submitError = (fieldId: string): string | undefined =>
    state.fieldErrors[fieldId] ??
    (fieldId === 'developmentConclusions' && conclusionsGate ? CONCLUSIONS_FIELD_ERROR : undefined);

  const negative =
    negativePoints !== null && Object.values(ratings).some((points) => points === negativePoints);
  // Typed dates of a failed submit win. After a saved one the page brings them back as `initial`,
  // together with what an action set meanwhile (the interview date).
  const dates = state.ok === true ? {} : state.values;
  const dateDefault = (name: 'interviewOn' | 'periodFrom' | 'periodTo'): string => {
    const typed = dates[name];
    if (typeof typed === 'string') return typed;
    return initial[name] ?? '';
  };

  // In the period the interview form above sets the interview date, so the sheet does not ask for
  // it twice. Without the field the save keeps the saved date (`sheetFromPartTwoForm`).
  const dateFields = (
    [
      ['interviewOn', 'Data rozmowy oceniającej'],
      ['periodFrom', 'Okres oceny od'],
      ['periodTo', 'Okres oceny do'],
    ] as const
  ).filter(([name]) => mode === 'edit' || name !== 'interviewOn');

  /** A fragment corrected in the quality check replaces its first occurrence, then the sheet is saved. */
  const replaceInJustification = (fragment: string, corrected: string): boolean => {
    if (!justification.includes(fragment)) return false;
    flushSync(() => {
      setJustification((current) => current.replace(fragment, corrected));
    });
    autosave.saveNow();
    return true;
  };

  const insertConclusions = (next: string) => {
    setConclusions(next);
    schedule();
  };

  // Decisions recorded in this session, until the refreshed page brings them with the run.
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  // Corrected texts of sentences edited in this session, for the decided line.
  const [editedTexts, setEditedTexts] = useState<Record<string, string>>({});
  const needsFocus = useRef(false);
  const decidedOf = (fragment: string, fromRun: Decision | null): Decision | null =>
    decisions[fragment] ?? fromRun;
  const aiRatings = (draft?.ratings ?? []).flatMap((proposal) =>
    proposal.points === null ? [] : [{ ...proposal, points: proposal.points }],
  );
  const aiSentences = draft?.sentences ?? [];

  const onDecide: DecideFn = async (fragment, decision, finalText) => {
    if (draft === null || draft === undefined) return null;
    await flush();
    const result = await decideFragment(id, draft.runId, fragment, decision, finalText);
    if (!result.ok) return result.formError ?? 'Nie udało się zapisać decyzji. Spróbuj ponownie.';
    if (decision !== 'rejected') {
      const rating = aiRatings.find((proposal) => proposal.fragment === fragment);
      const sentence = aiSentences.find((proposal) => proposal.fragment === fragment);
      // The fields render the accepted content first, then the sheet is saved at once, so a
      // reload never shows the decision without its rating or sentence.
      flushSync(() => {
        if (rating) {
          setRatings((current) => ({ ...current, [rating.criterionId]: rating.points }));
        } else if (sentence) {
          const added = finalText ?? sentence.text;
          if (sentence.target === 'justification') {
            setJustification((current) => appendSentence(current, added));
          } else {
            setConclusions((current) => appendSentence(current, added));
          }
        }
      });
      autosave.saveNow();
    }
    needsFocus.current = true;
    setDecisions((current) => ({ ...current, [fragment]: decision }));
    if (decision === 'edited' && finalText !== undefined) {
      setEditedTexts((current) => ({ ...current, [fragment]: finalText }));
    }
    router.refresh();
    return null;
  };

  // After a decision the focus goes to the next open suggestion, otherwise to the panel heading.
  useEffect(() => {
    if (!needsFocus.current) return;
    needsFocus.current = false;
    const next = formRef.current?.querySelector<HTMLElement>('[data-ai-suggestion][data-open]');
    (next ?? document.getElementById(AI_PANEL_TITLE_ID))?.focus();
  }, [decisions]);

  const firstOpenRating = aiRatings.find(
    (proposal) => decidedOf(proposal.fragment, proposal.decided) === null,
  );
  const anchorId = 'ai-proposals';
  const sentenceBlock = (target: 'justification' | 'developmentConclusions') => {
    const list = aiSentences.filter((proposal) => proposal.target === target);
    if (list.length === 0) return null;
    const hasOpen = list.some(
      (proposal) => decidedOf(proposal.fragment, proposal.decided) === null,
    );
    const firstSentenceBlock =
      firstOpenRating === undefined &&
      aiSentences.find((proposal) => decidedOf(proposal.fragment, proposal.decided) === null)
        ?.target === target;
    return (
      <div
        id={firstSentenceBlock && hasOpen ? anchorId : undefined}
        className="flex scroll-mt-4 flex-col gap-3"
      >
        {list.map((proposal) => {
          const decided = decidedOf(proposal.fragment, proposal.decided);
          return decided === null ? (
            <SentenceSuggestion
              key={proposal.fragment}
              proposal={proposal}
              noteDates={noteDates}
              onDecide={onDecide}
            />
          ) : (
            <DecidedLine
              key={proposal.fragment}
              text={decidedText(decided, {
                kind: 'sentence',
                text:
                  decided === 'edited'
                    ? (editedTexts[proposal.fragment] ?? proposal.finalText ?? proposal.text)
                    : proposal.text,
              })}
            />
          );
        })}
      </div>
    );
  };

  return (
    <SheetSaveProvider value={flush}>
      {mode === 'edit' && issues.length > 0 ? (
        <ErrorSummary title={gateTitle(issues.length)} errors={issues} autoFocus={false} />
      ) : null}
      <Section
        title="Część II. Ocena okresowa"
        flush
        id="part-two"
        actions={<SaveStatusLine status={status} onRetry={autosave.saveNow} />}
      >
        {interviewRecorded ? (
          <div
            ref={recordedRef}
            tabIndex={-1}
            className="border-rule border-b px-6 py-4 outline-offset-2 sm:px-8"
          >
            <Notice tone="success" role="status">
              <p>Rozmowę odnotowano. Możesz wypełnić i zatwierdzić część II.</p>
            </Notice>
          </div>
        ) : null}
        {before}
        {submitErrors.length > 0 || state.formError !== undefined ? (
          <div className="border-rule border-b px-6 py-4 sm:px-8">
            <ErrorSummary title="Nie udało się zapisać arkusza" errors={submitErrors}>
              {state.formError}
            </ErrorSummary>
          </div>
        ) : null}

        {/* The dates belong to the sheet form through the `form` attribute: the AI band below has a
            form of its own and must not sit inside the sheet form. */}
        {/* Keyed by mode: after the interview is recorded the inputs start again from the saved
            dates, which now hold the interview date the action set. */}
        <div
          key={mode}
          className={`border-rule grid border-b ${mode === 'period' ? 'md:grid-cols-2' : 'md:grid-cols-3'}`}
          onChange={schedule}
        >
          {dateFields.map(([name, label]) => (
            <div
              key={name}
              className="border-rule border-b px-6 py-4 last:border-b-0 sm:px-8 md:border-r md:border-b-0 md:px-5 md:last:border-r-0"
            >
              <Field id={name} label={label} error={submitError(name)}>
                <DateInput name={name} form={FORM_ID} defaultValue={dateDefault(name)} />
              </Field>
            </div>
          ))}
        </div>

        {aiPanel}

        <form
          id={FORM_ID}
          ref={formRef}
          action={formAction}
          onSubmit={onSubmit}
          noValidate
          onChange={schedule}
          className="flex flex-col"
        >
          {criteria.map((criterion) => {
            const titleId = `criterion-${criterion.id}-title`;
            const fieldId = `rating-${criterion.id}`;
            const error = submitError(fieldId);
            const proposal = aiRatings.find((entry) => entry.criterionId === criterion.id);
            const decided = proposal ? decidedOf(proposal.fragment, proposal.decided) : null;
            return (
              <section
                key={criterion.id}
                id={proposal && proposal === firstOpenRating ? anchorId : undefined}
                aria-labelledby={titleId}
                className="border-rule flex scroll-mt-4 flex-col gap-3 border-b px-6 py-[1.125rem] sm:px-8"
              >
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
                  <div className="flex min-w-[12rem] flex-col gap-0.5">
                    <p className="text-ink-muted text-sm leading-[normal]">
                      {criterion.mandatory ? 'Kryterium obowiązkowe' : 'Kryterium dodatkowe'}
                    </p>
                    <h3
                      id={titleId}
                      className="font-heading text-ink text-[1.1875rem] leading-[normal] font-semibold"
                    >
                      {criterion.name}
                    </h3>
                  </div>
                  {criterion.indicators.length > 0 ? (
                    <details className="max-w-full">
                      <summary className="font-heading text-link cursor-pointer text-[0.9375rem] leading-[normal] font-medium underline">
                        Wskaźniki zachowań
                      </summary>
                      <ul className="mt-2 flex max-w-[70ch] list-disc flex-col gap-1 pl-5">
                        {criterion.indicators.map((indicator) => (
                          <li key={indicator}>{indicator}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                </div>
                {error ? <FieldError id={fieldId}>{error}</FieldError> : null}
                <ScaleChoice
                  id={fieldId}
                  name={fieldId}
                  options={scale}
                  value={ratings[criterion.id] ?? null}
                  labelledBy={titleId}
                  suggested={proposal && decided === null ? proposal.points : null}
                  invalid={error !== undefined}
                  describedBy={error ? `${fieldId}-error` : undefined}
                  onChange={(value) => {
                    setRatings((current) => ({ ...current, [criterion.id]: value }));
                  }}
                />
                {proposal && decided === null ? (
                  <RatingSuggestion
                    proposal={proposal}
                    current={ratings[criterion.id] ?? null}
                    scale={scale}
                    noteDates={noteDates}
                    onDecide={onDecide}
                  />
                ) : null}
                {proposal && decided !== null ? (
                  <DecidedLine
                    text={decidedText(decided, {
                      kind: 'rating',
                      points: proposal.points,
                      level: scale.find((level) => level.value === proposal.points)?.name ?? null,
                    })}
                  />
                ) : null}
              </section>
            );
          })}

          <div className="border-rule flex flex-col gap-4 border-b px-6 py-5 sm:px-8">
            {sentenceBlock('justification')}
            <Field
              id="justification"
              label="Uzasadnienie oceny"
              hint="Wymagane przy ocenie negatywnej (§ 11 rozporządzenia)."
              optional={!negative}
              error={submitError('justification')}
            >
              <Textarea
                name="justification"
                rows={5}
                value={justification}
                onChange={(event) => {
                  setJustification(event.target.value);
                }}
              />
            </Field>
            <QualityCheck
              id={id}
              fieldId="justification"
              text={justification}
              criteria={criteria.map((criterion) => ({ id: criterion.id, name: criterion.name }))}
              flush={flush}
              onReplace={replaceInJustification}
            />
          </div>

          <div className="border-rule flex flex-col gap-5 border-b px-6 py-5 sm:px-8">
            {sentenceBlock('developmentConclusions')}
            <Field
              id="developmentConclusions"
              label="Wnioski do indywidualnego programu rozwoju zawodowego (IPRZ)"
              hint="Wymagane przy każdej ocenie (art. 81 ust. 5 ustawy). Napisz, co pracownik ma rozwijać w kolejnym okresie."
              error={submitError('developmentConclusions')}
            >
              <Textarea
                name="developmentConclusions"
                rows={6}
                value={conclusions}
                onChange={(event) => {
                  setConclusions(event.target.value);
                }}
              />
            </Field>
            {hints ? (
              <DevelopmentHints
                hints={hints}
                conclusions={conclusions}
                onChange={insertConclusions}
              />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-6 py-6 sm:px-8">
            {mode === 'edit' ? (
              <>
                <PendingSubmit
                  pending={submitting}
                  pendingLabel="Zapisuję"
                  size="lg"
                  className="gap-[0.625rem] [&_svg]:size-[1.125rem]"
                >
                  Sprawdź i zatwierdź ocenę
                  <ArrowRight aria-hidden />
                </PendingSubmit>
                <Link
                  href={routes.home}
                  onClick={() => {
                    autosave.flush();
                  }}
                  className="font-heading text-link font-medium underline"
                >
                  Wróć do pulpitu, zmiany są zapisane
                </Link>
              </>
            ) : (
              <PendingSubmit pending={submitting} pendingLabel="Zapisuję" variant="secondary">
                Zapisz szkic
              </PendingSubmit>
            )}
          </div>
        </form>
      </Section>
    </SheetSaveProvider>
  );
}
