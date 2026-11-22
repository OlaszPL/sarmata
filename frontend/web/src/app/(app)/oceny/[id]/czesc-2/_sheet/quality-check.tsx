'use client';

import { useState } from 'react';
import {
  AiMark,
  AiSuggestion,
  Button,
  Field,
  Notice,
  PixelLoader,
  Select,
  Textarea,
} from '@sarmata/ui';
import { pluralPl } from '@/lib/format';
import {
  type QualityCheckRun,
  decideQualityIssue,
  pollQualityCheck,
  startQualityCheck,
} from '../actions';
import { DecidedLine, type Decision } from './ai-proposals';
import { useAiRun } from './use-ai-run';

type IssueType = NonNullable<QualityCheckRun['output']>['issues'][number]['type'];
type Issue = NonNullable<QualityCheckRun['output']>['issues'][number];

const ISSUE_TITLES: Record<IssueType, string> = {
  no_example: 'Brak przykładu',
  no_date: 'Przykład bez daty',
  personality: 'Opis osobowości zamiast zachowań',
  private_sphere: 'Sfera prywatna',
  criterion_mismatch: 'Tekst nie pasuje do kryterium',
};

const CHECK_FAILED = 'Nie udało się sprawdzić tekstu. Spróbuj ponownie albo pracuj bez AI.';
const DECIDE_FAILED = 'Nie udało się zapisać decyzji. Spróbuj ponownie.';

const DECIDED_TEXT: Record<Decision, string> = {
  accepted: 'Uwaga przyjęta.',
  edited: 'Fragment poprawiony w tekście.',
  rejected: 'Uwaga odrzucona.',
};

export interface QualityCheckProps {
  /** Evaluation id. */
  id: string;
  /** Id of the checked text field, for the ids of the panel. */
  fieldId: string;
  /** The text as it is in the field now. */
  text: string;
  criteria: { id: string; name: string }[];
  /** Stores a change of the sheet that waits for the autosave pause. Runs before every AI call. */
  flush: () => Promise<void>;
  /**
   * Replaces the quoted fragment in the field with the corrected one and saves the sheet. False when
   * the field no longer holds the fragment.
   */
  onReplace: (fragment: string, corrected: string) => boolean;
}

function IssueCard({
  issue,
  index,
  fieldId,
  text,
  onDecide,
}: {
  issue: Issue;
  index: number;
  fieldId: string;
  text: string;
  onDecide: (decision: Decision, finalText?: string) => Promise<string | null>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [corrected, setCorrected] = useState(issue.fragment ?? '');
  const canEdit = issue.fragment !== null && issue.fragment !== '' && text.includes(issue.fragment);
  const editId = `${fieldId}-quality-edit-${index}`;

  const decide = async (decision: Decision, finalText?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      setError(await onDecide(decision, finalText));
    } catch {
      setError(DECIDE_FAILED);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div data-quality-issue className="outline-offset-2">
      <AiSuggestion
        title={ISSUE_TITLES[issue.type]}
        actions={
          editing ? (
            <>
              <Button
                variant="secondary"
                aria-disabled={busy}
                onClick={() => {
                  void decide('edited', corrected.trim());
                }}
              >
                Zapisz poprawkę
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(false);
                }}
              >
                Wróć do uwagi
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="secondary"
                aria-disabled={busy}
                onClick={() => {
                  void decide('accepted');
                }}
              >
                Przyjmij uwagę
              </Button>
              {canEdit ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setEditing(true);
                  }}
                >
                  Popraw fragment
                </Button>
              ) : null}
              <Button
                variant="secondary"
                aria-disabled={busy}
                onClick={() => {
                  void decide('rejected');
                }}
              >
                Odrzuć
              </Button>
            </>
          )
        }
      >
        {issue.fragment ? (
          <p className="max-w-[70ch]">
            Fragment: <q>{issue.fragment}</q>
          </p>
        ) : null}
        <p className="max-w-[70ch]">{issue.suggestion}</p>
        {editing ? (
          <Field id={editId} label="Poprawiony fragment" className="mt-2">
            <Textarea
              rows={3}
              value={corrected}
              onChange={(event) => {
                setCorrected(event.target.value);
              }}
            />
          </Field>
        ) : null}
        {error ? (
          <Notice tone="error" role="alert" className="mt-2">
            <p>{error}</p>
          </Notice>
        ) : null}
      </AiSuggestion>
    </div>
  );
}

/**
 * The text quality check next to a text field of part II: starts a `quality_check` run for the text
 * as typed, polls it and shows the remarks. Each remark is accepted, fixed in the text or rejected,
 * and the decision goes to the AI usage log.
 */
export function QualityCheck({ id, fieldId, text, criteria, flush, onReplace }: QualityCheckProps) {
  const { state, start, reset } = useAiRun(pollQualityCheck, CHECK_FAILED);
  const [criterionId, setCriterionId] = useState('');
  const [emptyError, setEmptyError] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const selectId = `${fieldId}-quality-criterion`;
  const busy = state.phase === 'starting' || state.phase === 'waiting';

  const onCheck = () => {
    if (busy) return;
    const checked = text.trim();
    if (checked === '') {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    setDecisions({});
    start(async () => {
      await flush();
      return startQualityCheck(id, criterionId === '' ? null : criterionId, checked);
    });
  };

  const decideIssue = async (
    runId: string,
    index: number,
    issue: Issue,
    decision: Decision,
    finalText?: string,
  ): Promise<string | null> => {
    const fragment = `issue.${index}`;
    await flush();
    if (decision === 'edited') {
      if (finalText === undefined || finalText === '') return 'Wpisz poprawiony fragment.';
      if (issue.fragment === null || !onReplace(issue.fragment, finalText)) {
        return 'Tego fragmentu nie ma już w tekście. Popraw tekst w polu.';
      }
    }
    const result = await decideQualityIssue(runId, fragment, decision, finalText);
    if (!result.ok) return result.formError ?? DECIDE_FAILED;
    setDecisions((current) => ({ ...current, [fragment]: decision }));
    return null;
  };

  const issues = state.phase === 'done' ? (state.run.output?.issues ?? []) : [];
  const decidedOf = (fragment: string): Decision | undefined =>
    decisions[fragment] ??
    (state.phase === 'done'
      ? state.run.decisions.filter((entry) => entry.fragment === fragment).at(-1)?.decision
      : undefined);
  const openCount = issues.filter((_, index) => decidedOf(`issue.${index}`) === undefined).length;

  return (
    // Changes inside the panel (criterion, corrected fragment) are not sheet changes.
    <div
      className="bg-band flex flex-col gap-3 px-4 py-4"
      onChange={(event) => {
        event.stopPropagation();
      }}
    >
      <p className="font-heading text-ink flex items-center gap-2 font-semibold">
        <AiMark className="size-4 shrink-0" />
        Kontrola jakości tekstu
      </p>
      <p className="max-w-[70ch] text-[0.9375rem]">
        AI sprawdzi, czy tekst podaje przykład z datą, nie opisuje osobowości ani życia prywatnego i
        pasuje do kryterium.
      </p>
      {state.phase === 'disabled' ? (
        <Notice tone="info">
          <p>{state.message}</p>
        </Notice>
      ) : (
        <div className="flex flex-wrap items-end gap-4">
          {criteria.length > 0 ? (
            <Field
              id={selectId}
              label="Sprawdź pod kątem kryterium"
              optional
              className="min-w-[16rem]"
            >
              <Select
                value={criterionId}
                onChange={(event) => {
                  setCriterionId(event.target.value);
                }}
              >
                <option value="">Bez kryterium</option>
                {criteria.map((criterion) => (
                  <option key={criterion.id} value={criterion.id}>
                    {criterion.name}
                  </option>
                ))}
              </Select>
            </Field>
          ) : null}
          <Button variant="secondary" aria-disabled={busy} onClick={onCheck}>
            {state.phase === 'done' ? 'Sprawdź ponownie' : 'Sprawdź tekst'}
          </Button>
        </div>
      )}
      {emptyError ? (
        <Notice tone="warning" role="alert">
          <p>Wpisz tekst w polu, zanim go sprawdzisz.</p>
        </Notice>
      ) : null}
      {state.phase === 'starting' || state.phase === 'waiting' ? (
        <PixelLoader
          label={
            state.phase === 'waiting' && !state.queued
              ? 'AI sprawdza tekst.'
              : 'Sprawdzenie czeka w kolejce.'
          }
        />
      ) : null}
      {state.phase === 'failed' ? (
        <Notice tone="warning">
          <p>{state.message}</p>
        </Notice>
      ) : null}
      {state.phase === 'timed_out' ? (
        <Notice tone="warning">
          <p>Sprawdzenie trwa dłużej niż zwykle. Możesz pracować dalej bez AI.</p>
          <Button variant="link" onClick={reset}>
            Zacznij od nowa
          </Button>
        </Notice>
      ) : null}
      {state.phase === 'done' ? (
        <div className="flex flex-col gap-3" role="status">
          {issues.length === 0 ? (
            <p>AI nie ma uwag do tego tekstu.</p>
          ) : (
            <p className="font-heading font-semibold">
              {openCount === 0
                ? 'Wszystkie uwagi przejrzane'
                : `${openCount} ${pluralPl(openCount, 'uwaga', 'uwagi', 'uwag')} do przejrzenia`}
            </p>
          )}
        </div>
      ) : null}
      {state.phase === 'done'
        ? issues.map((issue, index) => {
            const fragment = `issue.${index}`;
            const decided = decidedOf(fragment);
            return decided === undefined ? (
              <IssueCard
                key={fragment}
                issue={issue}
                index={index}
                fieldId={fieldId}
                text={text}
                onDecide={(decision, finalText) =>
                  decideIssue(state.runId, index, issue, decision, finalText)
                }
              />
            ) : (
              <DecidedLine
                key={fragment}
                text={`${ISSUE_TITLES[issue.type]}. ${DECIDED_TEXT[decided]}`}
              />
            );
          })
        : null}
    </div>
  );
}
