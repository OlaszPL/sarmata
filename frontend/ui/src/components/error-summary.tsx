'use client';

import { type MouseEvent, type ReactNode, useEffect, useId, useRef } from 'react';
import { cn } from 'cn';

export interface ErrorSummaryItem {
  /** Id of the control the link moves to. */
  fieldId: string;
  message: string;
  /** Link to a field on another page, e.g. `/oceny/1/czesc-2#developmentConclusions`. Default `#fieldId`. */
  href?: string | undefined;
}

interface ErrorSummaryProps {
  title: string;
  errors: readonly ErrorSummaryItem[];
  /** Text under the title, e.g. a form error that belongs to no field. */
  children?: ReactNode | undefined;
  className?: string | undefined;
  /** Take the focus when shown (default). Off for a banner that is present on page load. */
  autoFocus?: boolean | undefined;
  /**
   * Changes on every submit (the action state object or its round number), so a summary that stays
   * mounted takes the focus again when the same errors come back.
   */
  focusKey?: unknown;
}

/** Moves to the control and scrolls its label (or legend) into view, as GOV.UK does. */
function focusField(event: MouseEvent<HTMLAnchorElement>, fieldId: string) {
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
 * GOV.UK error summary: a red line on the left, the title and a link to every faulty field. It takes
 * the focus when it appears, so keyboard and screen reader users hear what went wrong.
 */
export function ErrorSummary({
  title,
  errors,
  children,
  className,
  autoFocus = true,
  focusKey,
}: ErrorSummaryProps) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const signature = `${title}|${errors.map((error) => `${error.fieldId}:${error.message}`).join('|')}`;

  useEffect(() => {
    if (autoFocus) ref.current?.focus();
  }, [signature, autoFocus, focusKey]);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      aria-labelledby={titleId}
      className={cn(
        'border-error flex flex-col gap-1.5 border-l-[0.625rem] bg-white py-[1.125rem] pr-6 pl-[1.875rem] outline-none',
        className,
      )}
    >
      <h2 id={titleId} className="text-ink text-[1.375rem] leading-[normal] font-semibold">
        {title}
      </h2>
      {children ? <div className="leading-[1.5]">{children}</div> : null}
      {errors.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {errors.map((error) => (
            <li key={`${error.fieldId}:${error.message}`}>
              <a
                href={error.href ?? `#${error.fieldId}`}
                onClick={(event) => {
                  if (!error.href) focusField(event, error.fieldId);
                }}
                className="font-heading text-error text-[1.0625rem] leading-[normal] font-medium underline"
              >
                {error.message}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
