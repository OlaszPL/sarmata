'use client';

import { Field, FieldError, ScaleChoice, Textarea } from '@sarmata/ui';
import type { FormState, FormValues } from '@/lib/form-action';
import { textValue } from './case-form';

interface SheetFieldsProps {
  criteria: readonly { id: string; name: string; indicators: string[] }[];
  scale: readonly { value: number; label: string }[];
  values: FormValues;
  fieldErrors: FormState['fieldErrors'];
}

/** Ids of the sheet fields top to bottom, for the error summary. */
export function sheetFieldIds(criteria: readonly { id: string }[]): string[] {
  return [
    ...criteria.map((criterion) => `rating-${criterion.id}`),
    'justification',
    'developmentConclusions',
  ];
}

/** Part II of the sheet: a rating per criterion, the justification and the development conclusions. */
export function SheetFields({ criteria, scale, values, fieldErrors }: SheetFieldsProps) {
  return (
    <div className="flex flex-col gap-8">
      {criteria.map((criterion) => {
        const key = `rating-${criterion.id}`;
        const error = fieldErrors[key];
        const raw = textValue(values, key);
        const current = raw === '' ? null : Number(raw);
        return (
          <fieldset
            key={criterion.id}
            className={`grid gap-2 ${error ? 'border-error border-l-[0.3125rem] pl-4' : ''}`}
          >
            <legend
              id={`${key}-legend`}
              className="font-heading text-ink mb-2 text-base leading-[normal] font-semibold"
            >
              {criterion.name}
            </legend>
            {criterion.indicators.length > 0 ? (
              <ul className="text-ink-muted max-w-[70ch] list-disc pl-5 text-[0.9375rem] leading-[1.4]">
                {criterion.indicators.map((indicator) => (
                  <li key={indicator}>{indicator}</li>
                ))}
              </ul>
            ) : null}
            {error ? <FieldError id={key}>{error}</FieldError> : null}
            <ScaleChoice
              id={key}
              name={key}
              options={scale}
              defaultValue={Number.isFinite(current) ? current : null}
              labelledBy={`${key}-legend`}
              describedBy={error ? `${key}-error` : undefined}
              invalid={error ? true : undefined}
            />
          </fieldset>
        );
      })}
      <Field
        id="justification"
        label="Uzasadnienie oceny"
        optional
        error={fieldErrors.justification}
      >
        <Textarea name="justification" rows={5} defaultValue={textValue(values, 'justification')} />
      </Field>
      <Field
        id="developmentConclusions"
        label="Wnioski do IPRZ"
        error={fieldErrors.developmentConclusions}
      >
        <Textarea
          name="developmentConclusions"
          rows={4}
          defaultValue={textValue(values, 'developmentConclusions')}
        />
      </Field>
    </div>
  );
}
