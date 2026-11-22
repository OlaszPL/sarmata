import { type ReactNode, useId } from 'react';
import { cn } from 'cn';
import { AiMark } from '#components/ai-mark';

interface AiSuggestionProps {
  title?: ReactNode | undefined;
  children: ReactNode;
  /** Where the suggestion comes from, e.g. links to the source notes. */
  sources?: ReactNode | undefined;
  /** Accept, edit and reject for this one fragment. Never "accept all". */
  actions: ReactNode;
  className?: string | undefined;
}

/**
 * A suggestion of the AI on the band background, with the AI mark and the reminder that the person
 * decides. Each suggestion is accepted or rejected on its own.
 */
export function AiSuggestion({ title, children, sources, actions, className }: AiSuggestionProps) {
  const titleId = useId();
  return (
    <div
      role="group"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : 'Sugestia AI'}
      className={cn('bg-band flex flex-col gap-3 px-4 py-3', className)}
    >
      <div className="flex items-start gap-3">
        <AiMark className="mt-1 size-4 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          {title ? (
            <p id={titleId} className="font-heading text-lg leading-[normal] font-semibold">
              {title}
            </p>
          ) : null}
          <div className="text-[0.9375rem] leading-[1.45]">{children}</div>
          {sources ? <div className="text-ink-muted text-sm leading-[1.45]">{sources}</div> : null}
          <p className="text-sm leading-[normal] font-semibold">
            Sugestia AI. Decyzję podejmujesz Ty.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 pl-7">{actions}</div>
    </div>
  );
}
