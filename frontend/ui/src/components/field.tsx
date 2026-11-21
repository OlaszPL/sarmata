import { Children, cloneElement, isValidElement, type ReactNode } from 'react';
import { CircleAlert } from 'lucide-react';
import { cn } from 'cn';

/** Border, height and states shared by every text-like control. The error state is a 3px red frame. */
export const controlClasses =
  'border-rule text-ink block h-12 w-full border bg-white px-3 text-base leading-[normal] aria-[invalid=true]:border-[3px] aria-[invalid=true]:border-error aria-[invalid=true]:px-[0.625rem] disabled:bg-band disabled:text-ink-muted';

/** Ids of the hint and error of a field, joined for `aria-describedby`. */
export function describedBy(
  id: string,
  { hint, error, extra }: { hint?: unknown; error?: unknown; extra?: string | undefined },
): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null, extra ?? null];
  return ids.filter(Boolean).join(' ') || undefined;
}

export function FieldLabelText({ label, optional }: { label: ReactNode; optional?: boolean }) {
  return (
    <>
      {label}
      {optional ? <span className="font-normal"> (opcjonalnie)</span> : null}
    </>
  );
}

export function FieldHint({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p id={`${id}-hint`} className="text-ink-muted text-[0.9375rem] leading-[1.4]">
      {children}
    </p>
  );
}

/** Error message next to a field: icon, red Fira text and a hidden "Błąd:" prefix for screen readers. */
export function FieldError({ id, children }: { id: string; children: ReactNode }) {
  return (
    <p
      id={`${id}-error`}
      className="font-heading text-error flex items-start gap-2 leading-[1.35] font-semibold"
    >
      <CircleAlert className="mt-0.5 size-[1.125rem] shrink-0" aria-hidden />
      <span>
        <span className="sr-only">Błąd: </span>
        {children}
      </span>
    </p>
  );
}

/** Wrapper of a field in the error state: the red line on the left, as in GOV.UK. */
export function fieldGroupClasses(error: unknown, className?: string): string {
  return cn('grid gap-2', error ? 'border-error border-l-[0.3125rem] pl-4' : null, className);
}

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string | undefined;
  /** Adds "(opcjonalnie)" to the label. Required fields carry no mark (GOV.UK). */
  optional?: boolean;
  className?: string;
  /** One control. It receives `id`, `aria-describedby` and `aria-invalid`. */
  children: ReactNode;
}

/**
 * A labelled form field: Fira label, optional hint, error message with an icon, and the control.
 * The hint and the error are linked to the control for screen readers.
 */
export function Field({
  id,
  label,
  hint,
  error,
  optional = false,
  className,
  children,
}: FieldProps) {
  const child = Children.only(children);
  const control = isValidElement<Record<string, unknown>>(child)
    ? cloneElement(child, {
        id,
        'aria-describedby':
          [describedBy(id, { hint, error }), child.props['aria-describedby']]
            .filter(Boolean)
            .join(' ') || undefined,
        'aria-invalid': error ? true : undefined,
      })
    : child;

  return (
    <div className={fieldGroupClasses(error, className)}>
      <label
        htmlFor={id}
        className="font-heading text-ink text-base leading-[normal] font-semibold"
      >
        <FieldLabelText label={label} optional={optional} />
      </label>
      {hint ? <FieldHint id={id}>{hint}</FieldHint> : null}
      {error ? <FieldError id={id}>{error}</FieldError> : null}
      {control}
    </div>
  );
}
