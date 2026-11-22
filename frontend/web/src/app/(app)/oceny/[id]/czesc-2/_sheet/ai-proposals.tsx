'use client';

import { useState } from 'react';
import { AiSuggestion, Button, Field, Notice, Textarea } from '@sarmata/ui';
import { type RatingProposal, type SentenceProposal } from '@/lib/evaluations/sheet-draft';
import { pluralPl } from '@/lib/format';

export type Decision = 'accepted' | 'edited' | 'rejected';

/** What the editor does with a decision. Resolves with a message when the decision failed. */
export type DecideFn = (
  fragment: string,
  decision: Decision,
  finalText?: string,
) => Promise<string | null>;

const DECIDED_TEXT: Record<Decision, string> = {
  accepted: 'Propozycję AI przyjęto',
  edited: 'Propozycję AI przyjęto z poprawkami',
  rejected: 'Propozycję AI odrzucono',
};

export function DecidedLine({ decided }: { decided: Decision }) {
  return <p className="text-ink-muted text-[0.9375rem]">{DECIDED_TEXT[decided]}</p>;
}

/** Dates of the source notes, without repeats. A note the account cannot read is named as such. */
function sourcesText(noteIds: string[], noteDates: Record<string, string>): string | null {
  if (noteIds.length === 0) return null;
  const dates = [...new Set(noteIds.map((noteId) => noteDates[noteId] ?? 'notatka niedostępna'))];
  return `Notatki: ${dates.join(', ')}`;
}

const open = { 'data-ai-suggestion': '', 'data-open': 'true', tabIndex: -1 } as const;

/** Rating proposal of one criterion: accept the points or keep the current rating. */
export function RatingSuggestion({
  proposal,
  current,
  scale,
  noteDates,
  onDecide,
}: {
  proposal: RatingProposal & { points: number };
  /** The rating chosen in the sheet now, null when none. */
  current: number | null;
  scale: { value: number; name: string }[];
  noteDates: Record<string, string>;
  onDecide: DecideFn;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const level = scale.find((entry) => entry.value === proposal.points)?.name;
  const count = proposal.noteIds.length;

  const decide = async (decision: Decision) => {
    setBusy(true);
    setError(await onDecide(proposal.fragment, decision));
    setBusy(false);
  };

  return (
    <div {...open} className="outline-offset-2">
      <AiSuggestion
        title={`AI proponuje ${proposal.points}${level ? `, ${level}` : ''}${
          count > 0
            ? `, na podstawie ${count} ${pluralPl(count, 'notatki', 'notatek', 'notatek')}`
            : ''
        }`}
        sources={sourcesText(proposal.noteIds, noteDates)}
        actions={
          <>
            <Button
              aria-disabled={busy}
              onClick={() => {
                if (!busy) void decide('accepted');
              }}
            >
              Przyjmij {proposal.points}
            </Button>
            <Button
              variant="secondary"
              aria-disabled={busy}
              onClick={() => {
                if (!busy) void decide('rejected');
              }}
            >
              {current === null ? 'Odrzuć' : `Zostaw ${current}`}
            </Button>
          </>
        }
      >
        <p>Ocena proponowana dla tego kryterium. Zaznaczona kafelkiem z przerywaną ramką.</p>
        {error ? (
          <Notice tone="error" role="alert" className="mt-2">
            <p>{error}</p>
          </Notice>
        ) : null}
      </AiSuggestion>
    </div>
  );
}

/** Sentence proposal for the justification or the conclusions: insert, fix and insert, or reject. */
export function SentenceSuggestion({
  proposal,
  noteDates,
  onDecide,
}: {
  proposal: SentenceProposal;
  noteDates: Record<string, string>;
  onDecide: DecideFn;
}) {
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(proposal.text);
  const insertLabel =
    proposal.target === 'justification' ? 'Wstaw do uzasadnienia' : 'Wstaw do wniosków';
  const fieldId = `ai-edit-${proposal.fragment.replace('.', '-')}`;

  const decide = async (decision: Decision, finalText?: string) => {
    setBusy(true);
    setError(await onDecide(proposal.fragment, decision, finalText));
    setBusy(false);
  };

  return (
    <div {...open} className="outline-offset-2">
      <AiSuggestion
        sources={sourcesText(proposal.noteIds, noteDates)}
        actions={
          editing ? (
            <>
              <Button
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void decide('edited', text.trim());
                }}
              >
                Wstaw poprawione
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
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void decide('accepted');
                }}
              >
                {insertLabel}
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Popraw i wstaw
              </Button>
              <Button
                variant="secondary"
                aria-disabled={busy}
                onClick={() => {
                  if (!busy) void decide('rejected');
                }}
              >
                Odrzuć
              </Button>
            </>
          )
        }
      >
        {editing ? (
          <Field id={fieldId} label="Zdanie do poprawienia">
            <Textarea
              rows={3}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
              }}
            />
          </Field>
        ) : (
          <p className="max-w-[70ch]">{proposal.text}</p>
        )}
        {error ? (
          <Notice tone="error" role="alert" className="mt-2">
            <p>{error}</p>
          </Notice>
        ) : null}
      </AiSuggestion>
    </div>
  );
}
