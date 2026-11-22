'use client';

import { Button } from '@sarmata/ui';
import { type DevelopmentService } from '@sarmata/services';
import { appendSentence } from '@/lib/evaluations/sheet-draft';

export type DevelopmentRecommendation = Awaited<ReturnType<DevelopmentService['recommend']>>;

/** Trainings shown per criterion in focus. */
const PER_CRITERION = 2;

/**
 * Hints for the IPRZ conclusions from the lowest rated criteria. They come from the rules and the
 * catalog, not from AI. Each one adds a sentence to the conclusions, the evaluator decides.
 */
export function DevelopmentHints({
  hints,
  conclusions,
  onChange,
}: {
  hints: DevelopmentRecommendation;
  conclusions: string;
  onChange: (next: string) => void;
}) {
  const rows = hints.focus.flatMap((criterion) =>
    criterion.trainings.slice(0, PER_CRITERION).map((training) => ({ criterion, training })),
  );
  const draft = hints.conclusionsDraft.trim();
  if (rows.length === 0 && draft === '') return null;

  return (
    <div className="flex flex-col gap-2" aria-labelledby="development-hints-title" role="group">
      <h4 id="development-hints-title" className="font-heading text-ink text-base font-semibold">
        Podpowiedzi z najniżej ocenionych kryteriów
      </h4>
      {conclusions.trim() === '' && draft !== '' ? (
        <div>
          <Button
            variant="link"
            onClick={() => {
              onChange(draft);
            }}
          >
            Wstaw szkic wniosków
          </Button>
        </div>
      ) : null}
      {rows.length > 0 ? (
        <ul className="flex flex-col">
          {rows.map(({ criterion, training }) => (
            <li
              key={`${criterion.criterionId}:${training.id}`}
              className="border-rule flex flex-wrap items-center justify-between gap-x-6 gap-y-1 border-b py-3 first:pt-1 last:border-b-0"
            >
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="font-heading text-ink text-base leading-[normal] font-semibold">
                  {training.title}
                </p>
                <p className="text-ink-muted text-[0.9375rem] leading-[normal]">
                  {training.organizer}, {training.form}, {training.cost}
                </p>
              </div>
              <Button
                variant="link"
                onClick={() => {
                  onChange(
                    appendSentence(
                      conclusions,
                      `${criterion.name}: ${training.title} (${training.organizer}).`,
                    ),
                  );
                }}
              >
                Wstaw do wniosków
                <span className="sr-only">: {training.title}</span>
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
