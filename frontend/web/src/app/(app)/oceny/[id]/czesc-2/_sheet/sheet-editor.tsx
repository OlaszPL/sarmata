'use client';

import { type ReactNode, useActionState, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LoaderCircle, CircleCheck, TriangleAlert } from 'lucide-react';
import {
  Button,
  DateInput,
  ErrorSummary,
  Field,
  FieldError,
  ScaleChoice,
  Section,
  SubmitButton,
  Textarea,
} from '@sarmata/ui';
import { LinkedErrorSummary } from '@/components/sheet/linked-error-summary';
import { useErrorTitle } from '@/components/use-error-title';
import { type PartTwoPatch } from '@/lib/evaluations/sheet-form';
import { type RatingProposal, type SentenceProposal } from '@/lib/evaluations/sheet-draft';
import { type GateLink, gateTitle } from '@/lib/evaluations/sheet-gates';
import { type FormState } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { type SaveResult, saveSheet, saveSheetAndCheck } from '../actions';
import { DevelopmentHints, type DevelopmentRecommendation } from './development-hints';

/** Pause after the last change before the sheet is saved. */
const AUTOSAVE_DELAY_MS = 1500;

const CONCLUSIONS_FIELD_ERROR = 'Wpisz wnioski do IPRZ. Bez nich nie zatwierdzisz oceny.';

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
  /** AI proposals of the newest draft run. Not rendered yet, the AI panel fills the slots later. */
  draft?:
    { ratings: RatingProposal[]; sentences: SentenceProposal[]; runId: string } | null | undefined;
  /** Note id to the date of the note, for the sources of AI proposals. */
  noteDates: Record<string, string>;
  /** Points that make an evaluation negative, null when the rules have none. */
  negativePoints: number | null;
  /** Content above the form inside the section, e.g. the interview form. */
  before?: ReactNode;
  /** Content between the dates and the criteria, the place of the AI draft panel. */
  aiPanel?: ReactNode;
}

type SaveStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved'; at: string }
  | { kind: 'error'; message: string };

/** Field id a link of the banner points to when it lives on this page, otherwise null. */
function localFieldId(href: string, pagePath: string): string | null {
  const [path, hash] = href.split('#');
  return path === pagePath && hash ? hash : null;
}

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
  before,
  aiPanel,
}: SheetEditorProps) {
  const router = useRouter();
  const pagePath = routes.evaluationPart2(id);
  const formRef = useRef<HTMLFormElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlight = useRef(false);
  const queued = useRef(false);

  const [ratings, setRatings] = useState<Record<string, number>>(initial.ratings);
  const [justification, setJustification] = useState(initial.justification);
  const [conclusions, setConclusions] = useState(initial.developmentConclusions);
  const [issues, setIssues] = useState(initialIssues);
  const [status, setStatus] = useState<SaveStatus>({ kind: 'idle' });

  const [state, formAction] = useActionState<FormState, FormData>(
    saveSheetAndCheck.bind(null, id),
    { values: {}, fieldErrors: {} },
  );
  const submitErrors = Object.entries(state.fieldErrors).flatMap(([fieldId, message]) =>
    message === undefined ? [] : [{ fieldId, message }],
  );
  useErrorTitle(submitErrors.length > 0 || state.formError !== undefined);

  const run = useCallback(async () => {
    const form = formRef.current;
    if (form === null) return;
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    inFlight.current = true;
    setStatus({ kind: 'saving' });
    try {
      let result: SaveResult;
      const takeQueued = () => {
        const wasQueued = queued.current;
        queued.current = false;
        return wasQueued;
      };
      do {
        result = await saveSheet(id, new FormData(form));
      } while (takeQueued() && result.ok);
      if (result.ok) {
        setStatus({ kind: 'saved', at: result.savedAt ?? '' });
        setIssues(result.issues);
        router.refresh();
      } else {
        setStatus({
          kind: 'error',
          message: result.formError ?? 'Nie udało się zapisać. Spróbuj ponownie.',
        });
      }
    } catch {
      setStatus({ kind: 'error', message: 'Nie udało się zapisać. Spróbuj ponownie.' });
    } finally {
      inFlight.current = false;
    }
  }, [id, router]);

  const schedule = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      timer.current = null;
      void run();
    }, AUTOSAVE_DELAY_MS);
  }, [run]);

  const saveNow = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
    void run();
  }, [run]);

  useEffect(
    () => () => {
      if (timer.current !== null) clearTimeout(timer.current);
    },
    [],
  );

  const gateErrors: Record<string, string> = {};
  if (mode === 'edit') {
    for (const item of issues) {
      const fieldId = localFieldId(item.href, pagePath);
      if (fieldId !== null) {
        gateErrors[fieldId] =
          fieldId === 'developmentConclusions' ? CONCLUSIONS_FIELD_ERROR : item.message;
      }
    }
  }
  const submitError = (fieldId: string) => state.fieldErrors[fieldId] ?? gateErrors[fieldId];

  const negative =
    negativePoints !== null && Object.values(ratings).some((points) => points === negativePoints);
  const dates = state.values;
  const dateDefault = (name: 'interviewOn' | 'periodFrom' | 'periodTo'): string => {
    const typed = dates[name];
    if (typeof typed === 'string') return typed;
    return initial[name] ?? '';
  };

  const insertConclusions = (next: string) => {
    setConclusions(next);
    schedule();
  };

  return (
    <>
      {mode === 'edit' && issues.length > 0 ? (
        <LinkedErrorSummary title={gateTitle(issues.length)} items={issues} />
      ) : null}
      <Section
        title="Część II. Ocena okresowa"
        flush
        id="part-two"
        actions={<SaveStatusLine status={status} onRetry={saveNow} />}
      >
        {before}
        <form
          ref={formRef}
          action={formAction}
          noValidate
          onChange={schedule}
          className="flex flex-col"
        >
          {submitErrors.length > 0 || state.formError !== undefined ? (
            <div className="border-rule border-b px-6 py-4 sm:px-8">
              <ErrorSummary title="Nie udało się zapisać arkusza" errors={submitErrors}>
                {state.formError}
              </ErrorSummary>
            </div>
          ) : null}

          <div className="border-rule grid border-b md:grid-cols-3">
            {(
              [
                ['interviewOn', 'Data rozmowy oceniającej'],
                ['periodFrom', 'Okres oceny od'],
                ['periodTo', 'Okres oceny do'],
              ] as const
            ).map(([name, label]) => (
              <div
                key={name}
                className="border-rule border-b px-6 py-4 last:border-b-0 sm:px-8 md:border-r md:border-b-0 md:last:border-r-0"
              >
                <Field id={name} label={label} error={submitError(name)}>
                  <DateInput name={name} defaultValue={dateDefault(name)} />
                </Field>
              </div>
            ))}
          </div>

          {aiPanel}

          {criteria.map((criterion) => {
            const titleId = `criterion-${criterion.id}-title`;
            const fieldId = `rating-${criterion.id}`;
            const error = submitError(fieldId);
            return (
              <section
                key={criterion.id}
                aria-labelledby={titleId}
                className="border-rule flex flex-col gap-3 border-b px-6 py-5 sm:px-8"
              >
                <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
                  <div className="flex min-w-[12rem] flex-col">
                    <p className="text-ink-muted text-[0.9375rem] leading-[normal]">
                      {criterion.mandatory ? 'Kryterium obowiązkowe' : 'Kryterium dodatkowe'}
                    </p>
                    <h3
                      id={titleId}
                      className="font-heading text-ink text-xl leading-[normal] font-semibold"
                    >
                      {criterion.name}
                    </h3>
                  </div>
                  {criterion.indicators.length > 0 ? (
                    <details className="max-w-full">
                      <summary className="font-heading text-link cursor-pointer text-[0.9375rem] font-medium underline">
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
                  invalid={error !== undefined}
                  describedBy={error ? `${fieldId}-error` : undefined}
                  onChange={(value) => {
                    setRatings((current) => ({ ...current, [criterion.id]: value }));
                  }}
                />
              </section>
            );
          })}

          <div className="border-rule border-b px-6 py-5 sm:px-8">
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
          </div>

          <div className="border-rule flex flex-col gap-5 border-b px-6 py-5 sm:px-8">
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
                <SubmitButton size="lg" pendingLabel="Zapisuję">
                  Sprawdź i zatwierdź ocenę
                </SubmitButton>
                <Link href={routes.home} className="font-heading text-link font-medium underline">
                  Wróć do pulpitu, zmiany są zapisane
                </Link>
              </>
            ) : (
              <SubmitButton variant="secondary" pendingLabel="Zapisuję">
                Zapisz szkic
              </SubmitButton>
            )}
          </div>
        </form>
      </Section>
    </>
  );
}
