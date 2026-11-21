import type { ChangeEvent, ReactNode } from 'react';
import { cn } from 'cn';
import {
  FieldError,
  FieldHint,
  FieldLabelText,
  describedBy,
  fieldGroupClasses,
} from '#components/field';

export interface RadioOption {
  value: string;
  label: ReactNode;
  hint?: ReactNode;
}

interface RadioGroupProps {
  name: string;
  legend: ReactNode;
  options: readonly RadioOption[];
  /** Id of the first radio, the target of error summary links. Defaults to `name`. */
  id?: string;
  /** Controlled value. Leave it out and use `defaultValue` in a plain form. */
  value?: string | null;
  defaultValue?: string | null;
  hint?: ReactNode;
  error?: string | undefined;
  optional?: boolean;
  /** Options side by side, for short answers such as "Tak" and "Nie". */
  inline?: boolean;
  disabled?: boolean;
  onChange?: (value: string, event: ChangeEvent<HTMLInputElement>) => void;
  className?: string;
}

/** A group of radio buttons in a fieldset with a legend, hint and error as in GOV.UK. */
export function RadioGroup({
  name,
  legend,
  options,
  id = name,
  value,
  defaultValue,
  hint,
  error,
  optional = false,
  inline = false,
  disabled,
  onChange,
  className,
}: RadioGroupProps) {
  const controlled = value !== undefined;
  return (
    <fieldset
      className={fieldGroupClasses(error, className)}
      aria-describedby={describedBy(id, { hint, error })}
    >
      <legend className="font-heading text-ink mb-2 text-base leading-[normal] font-semibold">
        <FieldLabelText label={legend} optional={optional} />
      </legend>
      {hint ? <FieldHint id={id}>{hint}</FieldHint> : null}
      {error ? <FieldError id={id}>{error}</FieldError> : null}
      <div className={cn('flex gap-3', inline ? 'flex-row flex-wrap gap-x-8' : 'flex-col')}>
        {options.map((option, index) => {
          const optionId = index === 0 ? id : `${id}-${option.value}`;
          return (
            <div key={option.value} className="flex items-start gap-3">
              <input
                type="radio"
                id={optionId}
                name={name}
                value={option.value}
                disabled={disabled}
                {...(controlled
                  ? { checked: value === option.value }
                  : { defaultChecked: defaultValue === option.value })}
                {...(onChange
                  ? {
                      onChange: (event: ChangeEvent<HTMLInputElement>) => {
                        onChange(option.value, event);
                      },
                    }
                  : controlled
                    ? { readOnly: true }
                    : {})}
                aria-describedby={option.hint ? `${optionId}-hint` : undefined}
                aria-invalid={error ? true : undefined}
                className="accent-navy mt-0.5 size-6 shrink-0 cursor-pointer"
              />
              <span className="grid gap-0.5">
                <label htmlFor={optionId} className="cursor-pointer leading-[1.5]">
                  {option.label}
                </label>
                {option.hint ? (
                  <span id={`${optionId}-hint`} className="text-ink-muted text-[0.9375rem]">
                    {option.hint}
                  </span>
                ) : null}
              </span>
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
