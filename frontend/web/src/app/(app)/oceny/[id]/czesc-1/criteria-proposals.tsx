'use client';

import { useState } from 'react';
import { AiMark, AiSuggestion, Button, Field, Notice, PixelLoader, Textarea } from '@sarmata/ui';
import { pluralPl } from '@/lib/format';
import { useAiRun } from '../czesc-2/_sheet/use-ai-run';
import {
  type CriteriaProposalsRun,
  decideCriteriaProposal,
  pollCriteriaProposals,
  startCriteriaProposals,
} from './actions';

type Decision = 'accepted' | 'edited' | 'rejected';

const PROPOSALS_FAILED = 'Nie udało się przygotować propozycji. Spróbuj ponownie albo wybierz sam.';
const DECIDE_FAILED = 'Nie udało się zapisać decyzji. Spróbuj ponownie.';

export const DUTIES_FIELD_ID = 'duties';

/** Runs one decision with a busy flag, a thrown error becomes the usual message. */
function useDecision(decide: (decision: Decision, finalText?: string) => Promise<string | null>) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async (decision: Decision, finalText?: string) => {
    if (busy) return;
    setBusy(true);
    try {
      setError(await decide(decision, finalText));
    } catch {
      setError(DECIDE_FAILED);
    } finally {
      setBusy(false);
    }
  };
  return { busy, error, run };
}

function ErrorLine({ error }: { error: string | null }) {
  if (error === null) return null;
  return (
    <Notice tone="error" role="alert" className="mt-2">
      <p>{error}</p>
    </Notice>
  );
}

function Expectations({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="flex max-w-[70ch] list-disc flex-col gap-1 pl-5">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function CriterionCard({
  name,
  reason,
  onDecide,
}: {
  name: string;
  reason: string;
  onDecide: (decision: Decision) => Promise<string | null>;
}) {
  const { busy, error, run } = useDecision(onDecide);
  return (
    <AiSuggestion
      title={`AI proponuje kryterium ${name}`}
      actions={
        <>
          <Button
            variant="secondary"
            aria-disabled={busy}
            onClick={() => {
              void run('accepted');
            }}
          >
            Dodaj kryterium
          </Button>
          <Button
            variant="secondary"
            aria-disabled={busy}
            onClick={() => {
              void run('rejected');
            }}
          >
            Odrzuć
          </Button>
        </>
      }
    >
      <p className="max-w-[70ch]">{reason}</p>
      <ErrorLine error={error} />
    </AiSuggestion>
  );
}

function ExpectationsCard({
  name,
  criterionId,
  items,
  onDecide,
}: {
  name: string;
  criterionId: string;
  items: string[];
  onDecide: (decision: Decision, finalText?: string) => Promise<string | null>;
}) {
  const { busy, error, run } = useDecision(onDecide);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(items.join('\n'));
  const editId = `expectations-edit-${criterionId}`;
  return (
    <AiSuggestion
      title={`Wskaźniki zachowań: ${name}`}
      actions={
        editing ? (
          <>
            <Button
              variant="secondary"
              aria-disabled={busy}
              onClick={() => {
                void run('edited', text.trim());
              }}
            >
              Zapisz poprawione
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(false);
              }}
            >
              Wróć do propozycji
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="secondary"
              aria-disabled={busy}
              onClick={() => {
                void run('accepted');
              }}
            >
              Przyjmij wskaźniki
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                setEditing(true);
              }}
            >
              Popraw
            </Button>
            <Button
              variant="secondary"
              aria-disabled={busy}
              onClick={() => {
                void run('rejected');
              }}
            >
              Odrzuć
            </Button>
          </>
        )
      }
    >
      {editing ? (
        <Field id={editId} label="Wskaźniki, każdy w osobnym wierszu">
          <Textarea
            rows={Math.max(3, items.length + 1)}
            value={text}
            onChange={(event) => {
              setText(event.target.value);
            }}
          />
        </Field>
      ) : (
        <Expectations items={items} />
      )}
      <ErrorLine error={error} />
    </AiSuggestion>
  );
}

function DecidedNote({ children }: { children: React.ReactNode }) {
  return <div className="text-ink-muted max-w-[70ch] text-[0.9375rem]">{children}</div>;
}

/**
 * Proposals of additional criteria and behavioural indicators for the starting interview, from the
 * duties of the evaluated person (`criteria_proposals`). An accepted criterion is ticked in the part
 * I form, the indicators stay here for the interview. Every decision goes to the AI usage log.
 */
export function CriteriaProposals({
  id,
  names,
  onAddCriterion,
}: {
  id: string;
  /** Criterion id to its name, mandatory and catalog criteria. */
  names: Record<string, string>;
  /** Ticks the criterion among the additional criteria of the form. */
  onAddCriterion: (criterionId: string) => void;
}) {
  const { state, start, reset } = useAiRun(pollCriteriaProposals, PROPOSALS_FAILED);
  const [duties, setDuties] = useState('');
  const [emptyError, setEmptyError] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, { decision: Decision; text?: string }>>(
    {},
  );
  const busy = state.phase === 'starting' || state.phase === 'waiting';
  const nameOf = (criterionId: string) => names[criterionId] ?? criterionId;

  const onPropose = () => {
    if (busy) return;
    const text = duties.trim();
    if (text === '') {
      setEmptyError(true);
      return;
    }
    setEmptyError(false);
    setDecisions({});
    start(() => startCriteriaProposals(id, text));
  };

  const decide =
    (run: CriteriaProposalsRun, fragment: string, criterionId: string) =>
    async (decision: Decision, finalText?: string): Promise<string | null> => {
      if (decision === 'edited' && (finalText === undefined || finalText === '')) {
        return 'Wpisz poprawione wskaźniki.';
      }
      const result = await decideCriteriaProposal(run.id, fragment, decision, finalText);
      if (!result.ok) return result.formError ?? DECIDE_FAILED;
      if (decision === 'accepted' && fragment.startsWith('criterion.')) onAddCriterion(criterionId);
      setDecisions((current) => ({
        ...current,
        [fragment]: finalText === undefined ? { decision } : { decision, text: finalText },
      }));
      return null;
    };

  const decidedOf = (
    run: CriteriaProposalsRun,
    fragment: string,
  ): { decision: Decision; text?: string } | undefined => {
    const local = decisions[fragment];
    if (local !== undefined) return local;
    const saved = run.decisions.filter((entry) => entry.fragment === fragment).at(-1);
    if (saved === undefined) return undefined;
    return saved.finalText === null
      ? { decision: saved.decision }
      : { decision: saved.decision, text: saved.finalText };
  };

  const output = state.phase === 'done' ? state.run.output : null;
  const proposals = output?.additionalCriteria ?? [];
  const expectations = output?.behaviouralExpectations ?? [];

  return (
    <section
      aria-labelledby="criteria-proposals-title"
      className="bg-band flex flex-col gap-4 px-4 py-4 sm:px-6"
    >
      <h3
        id="criteria-proposals-title"
        className="font-heading text-ink flex items-center gap-2 text-base leading-[normal] font-semibold"
      >
        <AiMark className="size-4 shrink-0" />
        Propozycje kryteriów od AI
      </h3>
      <p className="max-w-[70ch] text-[0.9375rem]">
        Opisz obowiązki ocenianej osoby. AI zaproponuje kryteria dodatkowe z katalogu i wskaźniki
        zachowań do rozmowy rozpoczynającej. Każdą propozycję przyjmujesz albo odrzucasz osobno.
      </p>
      {state.phase === 'disabled' ? (
        <Notice tone="info">
          <p>{state.message}</p>
        </Notice>
      ) : (
        <>
          <Field
            id={DUTIES_FIELD_ID}
            label="Obowiązki na stanowisku"
            hint="Na przykład z opisu stanowiska. Tekst trafia tylko do AI, nie do arkusza."
          >
            <Textarea
              rows={4}
              value={duties}
              maxLength={10_000}
              onChange={(event) => {
                setDuties(event.target.value);
              }}
            />
          </Field>
          <div>
            <Button variant="secondary" aria-disabled={busy} onClick={onPropose}>
              {state.phase === 'done' ? 'Zaproponuj ponownie' : 'Zaproponuj kryteria'}
            </Button>
          </div>
        </>
      )}
      {emptyError ? (
        <Notice tone="warning" role="alert">
          <p>Opisz obowiązki, zanim poprosisz o propozycje.</p>
        </Notice>
      ) : null}
      {busy ? (
        <PixelLoader
          label={
            state.phase === 'waiting' && !state.queued
              ? 'AI przygotowuje propozycje.'
              : 'Prośba czeka w kolejce.'
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
          <p>Propozycje powstają dłużej niż zwykle. Wybierz kryteria samodzielnie.</p>
          <Button variant="link" onClick={reset}>
            Zacznij od nowa
          </Button>
        </Notice>
      ) : null}
      {state.phase === 'done' ? (
        <>
          <p role="status" className="font-heading font-semibold">
            {proposals.length === 0
              ? 'AI nie proponuje kryteriów dodatkowych.'
              : `AI proponuje ${proposals.length} ${pluralPl(proposals.length, 'kryterium', 'kryteria', 'kryteriów')}`}
          </p>
          {proposals.map((proposal) => {
            const fragment = `criterion.${proposal.criterionId}`;
            const decided = decidedOf(state.run, fragment);
            return decided === undefined ? (
              <CriterionCard
                key={fragment}
                name={nameOf(proposal.criterionId)}
                reason={proposal.reason}
                onDecide={decide(state.run, fragment, proposal.criterionId)}
              />
            ) : (
              <DecidedNote key={fragment}>
                {decided.decision === 'rejected'
                  ? `Odrzucono propozycję kryterium ${nameOf(proposal.criterionId)}.`
                  : `Dodano kryterium ${nameOf(proposal.criterionId)} do kryteriów dodatkowych.`}
              </DecidedNote>
            );
          })}
          {expectations.map((entry) => {
            const fragment = `expectations.${entry.criterionId}`;
            const decided = decidedOf(state.run, fragment);
            return decided === undefined ? (
              <ExpectationsCard
                key={fragment}
                name={nameOf(entry.criterionId)}
                criterionId={entry.criterionId}
                items={entry.expectations}
                onDecide={decide(state.run, fragment, entry.criterionId)}
              />
            ) : decided.decision === 'rejected' ? (
              <DecidedNote key={fragment}>
                Odrzucono wskaźniki zachowań: {nameOf(entry.criterionId)}.
              </DecidedNote>
            ) : (
              <DecidedNote key={fragment}>
                <p>Wskaźniki zachowań do rozmowy rozpoczynającej: {nameOf(entry.criterionId)}</p>
                <Expectations
                  items={
                    decided.text === undefined
                      ? entry.expectations
                      : decided.text.split('\n').filter((line) => line.trim() !== '')
                  }
                />
              </DecidedNote>
            );
          })}
        </>
      ) : null}
    </section>
  );
}
