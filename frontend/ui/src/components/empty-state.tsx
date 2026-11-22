import type { ReactNode } from 'react';
import { cn } from 'cn';

/** 0 empty, 1 navy, 2 gold: an open box with a spark, 6 by 6 pixels. */
const rows = ['000020', '000000', '100001', '100001', '111111', '000000'];
const fills: Record<string, string | undefined> = { '1': 'var(--navy)', '2': 'var(--gold)' };

function EmptyPixels() {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden focusable="false">
      {rows.flatMap((row, y) =>
        row.split('').map((cell, x) => {
          const fill = fills[cell];
          return fill ? (
            <rect key={`${x}-${y}`} x={x * 8} y={y * 8} width="8" height="8" fill={fill} />
          ) : null;
        }),
      )}
    </svg>
  );
}

interface EmptyStateProps {
  title: string;
  /** What to do next. */
  children: ReactNode;
  action?: ReactNode | undefined;
  className?: string | undefined;
}

/** Nothing to show yet: a small pixel drawing, a title, the next step and an optional action. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-start gap-3 px-6 py-10 sm:px-8', className)}>
      <EmptyPixels />
      <p className="font-heading text-ink text-[1.375rem] leading-[normal] font-semibold">
        {title}
      </p>
      <div className="leading-[1.5]">{children}</div>
      {action ? <div className="pt-2">{action}</div> : null}
    </div>
  );
}
