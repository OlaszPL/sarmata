import { Square, SquareCheck, SquareDot } from 'lucide-react';
import { cn } from 'cn';

export type StageState = 'done' | 'current' | 'next';

export interface Stage {
  label: string;
  /** Second line: a date, "w trakcie" or "Jeszcze niedostępne". */
  date?: string | undefined;
  state: StageState;
}

const stateText: Record<StageState, string> = {
  done: 'zakończony',
  current: 'bieżący',
  next: 'przed nami',
};

const icons = { done: SquareCheck, current: SquareDot, next: Square } as const;

interface StageStripProps {
  stages: readonly Stage[];
  /** Accessible name of the list. */
  label?: string | undefined;
  className?: string | undefined;
}

/**
 * Stages of a process in one row of equal cells (a column on narrow screens). The current one has the band background, a navy
 * bar and `aria-current="step"`, every state also has its own icon and hidden text.
 */
export function StageStrip({ stages, label = 'Etapy oceny', className }: StageStripProps) {
  return (
    <ol aria-label={label} className={cn('flex flex-col lg:flex-row', className)}>
      {stages.map((stage, index) => {
        const Icon = icons[stage.state];
        const current = stage.state === 'current';
        return (
          <li
            key={`${stage.label}-${index}`}
            aria-current={current ? 'step' : undefined}
            className={cn(
              // One column below lg (no cell lines doubling the page rails), one row from lg.
              'border-rule relative flex min-w-0 flex-1 flex-col gap-1 px-4 py-3.5',
              index < stages.length - 1 ? 'border-b lg:border-r lg:border-b-0' : null,
              current ? 'bg-band' : 'bg-white',
            )}
          >
            <span className="flex items-center gap-1.5">
              <Icon
                className={cn(
                  'size-[1.125rem] shrink-0',
                  stage.state === 'next' ? 'text-ink-muted' : 'text-navy',
                )}
                aria-hidden
              />
              <span
                className={cn(
                  'font-heading text-[0.9375rem] leading-[normal]',
                  current ? 'font-semibold' : 'font-medium',
                  stage.state === 'next' ? 'text-ink-muted' : 'text-ink',
                )}
              >
                {stage.label}
                <span className="sr-only">, etap {stateText[stage.state]}</span>
              </span>
            </span>
            {stage.date ? (
              <span className="text-ink-muted text-sm leading-[normal]">{stage.date}</span>
            ) : null}
            {current ? (
              <span className="bg-navy absolute inset-x-0 -bottom-px h-1" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
