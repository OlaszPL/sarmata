import type { InputHTMLAttributes, ReactNode } from 'react';
import { cn } from 'cn';
import { FieldError } from '#components/field';

export type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> & {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
};

/** A single checkbox with its label on the right, an optional hint and an error message. */
export function Checkbox({ id, label, hint, error, className, ...props }: CheckboxProps) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ');
  return (
    <div
      className={cn(
        'grid gap-2',
        error ? 'border-error border-l-[0.3125rem] pl-4' : null,
        className,
      )}
    >
      {error ? <FieldError id={id}>{error}</FieldError> : null}
      <div className="flex items-start gap-3">
        <input
          type="checkbox"
          id={id}
          aria-describedby={ids || undefined}
          aria-invalid={error ? true : undefined}
          className="accent-navy mt-0.5 size-6 shrink-0 cursor-pointer"
          {...props}
        />
        <span className="grid gap-0.5">
          <label htmlFor={id} className="cursor-pointer leading-[1.5]">
            {label}
          </label>
          {hint ? (
            <span id={`${id}-hint`} className="text-ink-muted text-[0.9375rem]">
              {hint}
            </span>
          ) : null}
        </span>
      </div>
    </div>
  );
}
