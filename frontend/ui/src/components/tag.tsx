import type { ReactNode } from 'react';
import { CircleCheck, CircleDashed, Clock, Hourglass, TriangleAlert } from 'lucide-react';
import { cn } from 'cn';

export type TagTone = 'todo' | 'progress' | 'attention' | 'waiting' | 'done' | 'neutral';

const tones: Record<TagTone, { icon: typeof Clock | null; className: string }> = {
  todo: { icon: CircleDashed, className: 'text-navy border-navy' },
  progress: { icon: Clock, className: 'text-navy border-navy' },
  attention: { icon: TriangleAlert, className: 'text-error border-error' },
  waiting: { icon: Hourglass, className: 'text-warning border-warning' },
  done: { icon: CircleCheck, className: 'text-success border-success' },
  neutral: { icon: null, className: 'text-ink border-rule' },
};

interface TagProps {
  tone: TagTone;
  children: ReactNode;
  className?: string;
}

/** A framed status label. The icon and the text carry the state, never the color alone. */
export function Tag({ tone, children, className }: TagProps) {
  const { icon: Icon, className: toneClasses } = tones[tone];
  return (
    <span
      className={cn(
        'font-heading inline-flex min-h-7 items-center gap-1.5 border bg-white px-2 text-sm leading-[normal] font-semibold whitespace-nowrap',
        toneClasses,
        className,
      )}
    >
      {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
      {children}
    </span>
  );
}
