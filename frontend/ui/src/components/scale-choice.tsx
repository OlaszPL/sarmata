import type { ChangeEvent, ReactNode } from 'react';
import { cn } from 'cn';

export interface ScaleOption {
  value: number;
  label: string;
}

interface ScaleChoiceProps {
  name: string;
  options: readonly ScaleOption[];
  /** Controlled value. Leave it out and use `defaultValue` in a plain form. */
  value?: number | null;
  defaultValue?: number | null;
  /** A value proposed by the AI: a dashed navy frame and a hidden note for screen readers. */
  suggested?: number | null;
  onChange?: (value: number, event: ChangeEvent<HTMLInputElement>) => void;
  /** Id of the first tile's radio, the target of error summary links. Defaults to `name`. */
  id?: string;
  /** Accessible name of the group, e.g. the criterion. Visible labels sit outside. */
  label?: string;
  /** Id of a visible heading that names the group, used instead of `label`. */
  labelledBy?: string;
  describedBy?: string;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
}

/**
 * Rating tiles of a partial scale (1, 3, 5, 7, 9). Native radios underneath, so arrow keys move the
 * choice and the form posts the value. The chosen tile is navy, the suggested one has a dashed frame.
 */
export function ScaleChoice({
  name,
  options,
  value,
  defaultValue,
  suggested = null,
  onChange,
  id = name,
  label,
  labelledBy,
  describedBy,
  invalid = false,
  disabled,
  className,
}: ScaleChoiceProps) {
  const controlled = value !== undefined;
  return (
    <div
      role="radiogroup"
      aria-label={labelledBy ? undefined : label}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-invalid={invalid ? true : undefined}
      className={cn(
        'flex w-full flex-wrap border sm:flex-nowrap',
        invalid ? 'border-error border-[3px]' : 'border-rule',
        className,
      )}
    >
      {options.map((option, index) => {
        const optionId = index === 0 ? id : `${id}-${option.value}`;
        const isSuggested = suggested === option.value;
        let note: ReactNode = null;
        if (isSuggested) note = <span className="sr-only">, propozycja AI</span>;
        return (
          <label
            key={option.value}
            htmlFor={optionId}
            className={cn(
              'group relative flex min-h-[4.0625rem] min-w-[33%] flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 bg-white px-1 py-2.5 text-center sm:min-w-0',
              index < options.length - 1 ? 'border-rule border-r' : null,
              'hover:bg-band has-[:checked]:bg-navy has-[:checked]:text-white',
              'has-[:focus-visible]:z-10 has-[:focus-visible]:outline-[3px] has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--focus)] has-[:focus-visible]:outline-solid has-[:focus-visible]:shadow-[0_0_0_2px_#fff]',
              isSuggested
                ? 'outline-navy outline-2 -outline-offset-[0.1875rem] outline-dashed'
                : null,
              disabled ? 'cursor-not-allowed opacity-60' : null,
            )}
          >
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
              className="sr-only"
            />
            <span className="font-heading text-xl leading-[normal] font-semibold">
              {option.value}
            </span>
            <span className="text-ink-muted text-sm leading-[normal] group-has-[:checked]:text-white">
              {option.label}
              {note}
            </span>
          </label>
        );
      })}
    </div>
  );
}
