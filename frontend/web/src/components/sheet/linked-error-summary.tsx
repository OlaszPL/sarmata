'use client';

import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { type GateLink } from '@/lib/evaluations/sheet-gates';

interface LinkedErrorSummaryProps {
  title: string;
  items: readonly GateLink[];
  /** Take the focus on mount and when the items change, for the result of a submit. */
  autoFocus?: boolean | undefined;
  /** Text under the title, e.g. an error that belongs to no field. */
  children?: ReactNode | undefined;
  className?: string | undefined;
}

/** Moves to a control on this page and scrolls its label into view, as the GOV.UK summary does. */
function focusField(event: MouseEvent<HTMLAnchorElement>, href: string) {
  if (!href.startsWith('#')) return;
  const fieldId = href.slice(1);
  const target = document.getElementById(fieldId);
  if (!target) return;
  event.preventDefault();
  const label =
    target.closest('fieldset')?.querySelector('legend') ??
    document.querySelector(`label[for="${CSS.escape(fieldId)}"]`);
  (label ?? target).scrollIntoView({ block: 'start' });
  target.focus({ preventScroll: true });
}

/**
 * Error summary with full hrefs, so a link can lead to a field on another tab of the sheet. Same
 * look as `ErrorSummary` from the UI package. Without `autoFocus` it is a passive banner.
 */
export function LinkedErrorSummary({
  title,
  items,
  autoFocus = false,
  children,
  className,
}: LinkedErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const signature = `${title}|${items.map((item) => `${item.href}:${item.message}`).join('|')}`;

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [signature, autoFocus]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={[
        'border-error flex flex-col gap-1.5 border-l-[0.625rem] bg-white py-[1.125rem] pr-6 pl-[1.875rem] outline-none',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <h2 id={titleId} className="text-ink text-[1.375rem] leading-[normal] font-semibold">
        {title}
      </h2>
      {children ? <div className="leading-[1.5]">{children}</div> : null}
      {items.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {items.map((item) => (
            <li key={`${item.href}:${item.message}`}>
              <a
                href={item.href}
                onClick={(event) => {
                  focusField(event, item.href);
                }}
                className="font-heading text-error text-[1.0625rem] leading-[normal] font-medium underline"
              >
                {item.message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
