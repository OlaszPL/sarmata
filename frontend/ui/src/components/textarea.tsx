'use client';

import { type ChangeEvent, type TextareaHTMLAttributes, useEffect, useState } from 'react';
import { cn } from 'cn';
import { controlClasses } from '#components/field';

export type TextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'maxLength'> & {
  /** Limit shown by the counter. It never blocks typing (GOV.UK character count). */
  maxLength?: number;
  /** Shows "Pozostało N znaków" under the field. Needs `maxLength`. */
  showCount?: boolean;
};

/** Delay before screen readers hear the new count, so they are not interrupted on every key. */
const ANNOUNCE_DELAY_MS = 1000;

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const lastTwo = n % 100;
  const last = n % 10;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return few;
  return many;
}

/** Polish text of the character counter: what is left, or how far over the limit the text is. */
export function remainingCharsText(length: number, max: number): string {
  const left = max - length;
  if (left >= 0) {
    return `${plural(left, 'Pozostał', 'Pozostały', 'Pozostało')} ${left} ${plural(left, 'znak', 'znaki', 'znaków')}`;
  }
  const over = -left;
  return `Za dużo o ${over} ${plural(over, 'znak', 'znaki', 'znaków')}`;
}

function initialLength(value: TextareaProps['value'], defaultValue: TextareaProps['defaultValue']) {
  const text = value ?? defaultValue ?? '';
  return String(text).length;
}

/** Multi-line text with an optional counter. Put it inside `Field`. */
export function Textarea({
  className,
  maxLength,
  showCount = false,
  rows = 5,
  onChange,
  ...props
}: TextareaProps) {
  const [length, setLength] = useState(() => initialLength(props.value, props.defaultValue));
  const [announced, setAnnounced] = useState(length);
  const counting = showCount && maxLength !== undefined;

  useEffect(() => {
    if (!counting) return;
    const timer = setTimeout(() => {
      setAnnounced(length);
    }, ANNOUNCE_DELAY_MS);
    return () => {
      clearTimeout(timer);
    };
  }, [counting, length]);

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setLength(event.target.value.length);
    onChange?.(event);
  };

  const countId = props.id ? `${props.id}-count` : undefined;
  const describedBy =
    [props['aria-describedby'], counting ? countId : null].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-1.5">
      <textarea
        rows={rows}
        className={cn(controlClasses, 'h-auto min-h-24 resize-y py-2.5 leading-[1.5]', className)}
        {...props}
        aria-describedby={describedBy}
        onChange={handleChange}
      />
      {counting ? (
        <>
          <p
            id={countId}
            aria-hidden
            className={cn(
              'text-[0.9375rem] leading-[normal]',
              length > maxLength ? 'font-heading text-error font-semibold' : 'text-ink-muted',
            )}
          >
            {remainingCharsText(length, maxLength)}
          </p>
          <p className="sr-only" aria-live="polite">
            {remainingCharsText(announced, maxLength)}
          </p>
        </>
      ) : null}
    </div>
  );
}
