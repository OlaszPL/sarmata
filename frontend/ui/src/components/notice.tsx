import type { HTMLAttributes, ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { cn } from 'cn';

export type NoticeTone = 'info' | 'warning' | 'success' | 'error';

const tones: Record<NoticeTone, { icon: typeof Info; line: string; text: string }> = {
  info: { icon: Info, line: 'border-navy', text: 'text-navy' },
  warning: { icon: TriangleAlert, line: 'border-warning', text: 'text-warning' },
  success: { icon: CircleCheck, line: 'border-success', text: 'text-success' },
  error: { icon: CircleAlert, line: 'border-error', text: 'text-error' },
};

type NoticeProps = Omit<HTMLAttributes<HTMLDivElement>, 'title'> & {
  tone: NoticeTone;
  title?: ReactNode;
  children: ReactNode;
};

/**
 * A message block with a colored line on the left and an icon. Pass `role="status"` when it appears
 * after an action, so screen readers announce it.
 */
export function Notice({ tone, title, children, className, ...props }: NoticeProps) {
  const { icon: Icon, line, text } = tones[tone];
  return (
    <div
      className={cn('bg-band flex gap-3 border-l-[0.3125rem] px-5 py-4', line, className)}
      {...props}
    >
      <Icon className={cn('mt-0.5 size-5 shrink-0', text)} aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        {title ? (
          <p className="font-heading text-ink text-lg leading-[normal] font-semibold">{title}</p>
        ) : null}
        <div className="leading-[1.5]">{children}</div>
      </div>
    </div>
  );
}
