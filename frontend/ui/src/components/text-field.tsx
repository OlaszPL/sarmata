import type { ComponentProps } from 'react';
import { Input } from '#shadcn/ui/input';
import { Label } from '#shadcn/ui/label';

type TextFieldProps = Omit<
  ComponentProps<typeof Input>,
  'id' | 'aria-describedby' | 'aria-invalid'
> & {
  id: string;
  label: string;
  hint?: string;
  error?: string;
};

/**
 * Labelled text input with an optional hint and error message, both linked to the input for
 * screen readers. The error sits above the input (GOV.UK and gov.pl field pattern).
 */
export function TextField({ id, label, hint, error, className, ...inputProps }: TextFieldProps) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(' ') || undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="text-base font-semibold">
        {label}
      </Label>
      {hint ? (
        <p id={hintId} className="text-sm text-muted-foreground">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-semibold text-destructive">
          <span className="sr-only">Błąd: </span>
          {error}
        </p>
      ) : null}
      <Input
        id={id}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={['h-11 text-base', className].filter(Boolean).join(' ')}
        {...inputProps}
      />
    </div>
  );
}
