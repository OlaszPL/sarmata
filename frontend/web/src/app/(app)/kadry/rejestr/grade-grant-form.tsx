'use client';

import {
  DateInput,
  ErrorSummary,
  Field,
  Notice,
  RadioGroup,
  Select,
  SubmitButton,
} from '@sarmata/ui';
import { useFormRound } from '@/lib/use-form-round';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { recordGradeGrant } from './actions';

export interface GradeGrantOption {
  value: string;
  label: string;
}

export interface GradeGrantDefaults {
  employeeId: string;
  basis: string;
  evaluationId: string;
}

/** Controls of this form in page order, the ids an error summary links to. */
const FIELDS = ['employeeId', 'basis', 'evaluationId', 'grantedOn', 'newGrade'];
const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9];

function text(values: FormState['values'], key: string, fallback: string): string {
  const value = values[key];
  return typeof value === 'string' ? value : fallback;
}

export function GradeGrantForm({
  employees,
  evaluations,
  defaults,
}: {
  employees: readonly GradeGrantOption[];
  evaluations: readonly GradeGrantOption[];
  defaults: GradeGrantDefaults;
}) {
  const [state, formAction] = useFormRound(recordGradeGrant);

  const errors = FIELDS.flatMap((fieldId) => {
    const message = state.fieldErrors[fieldId];
    return message ? [{ fieldId, message }] : [];
  });
  const otherErrors = Object.entries(state.fieldErrors).flatMap(([key, message]) =>
    message && !FIELDS.includes(key) ? [message] : [],
  );
  const formErrors = [...(state.formError ? [state.formError] : []), ...otherErrors];
  const failed = errors.length > 0 || formErrors.length > 0;
  useErrorTitle(failed);

  // After a save the form is empty again, before the first send it carries the page defaults.
  const pristine = Object.keys(state.values).length === 0 && !state.ok;
  const value = (key: string, initial = ''): string =>
    state.ok ? '' : pristine ? initial : text(state.values, key, '');

  return (
    <form key={state.round} action={formAction} noValidate className="grid max-w-[46rem] gap-6">
      {state.ok ? (
        <Notice tone="success" role="status">
          Zapisano wpis w rejestrze.
        </Notice>
      ) : null}
      {failed ? (
        <ErrorSummary title="Nie udało się przyznać stopnia" errors={errors}>
          {formErrors.length > 0 ? (
            <div className="grid max-w-[70ch] gap-1">
              {formErrors.map((message) => (
                <p key={message}>{message}</p>
              ))}
            </div>
          ) : null}
        </ErrorSummary>
      ) : null}
      <Field id="employeeId" label="Pracownik" error={state.fieldErrors.employeeId}>
        <Select name="employeeId" defaultValue={value('employeeId', defaults.employeeId)}>
          <option value="">Wybierz pracownika</option>
          {employees.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <RadioGroup
        name="basis"
        id="basis"
        legend="Podstawa przyznania"
        defaultValue={value('basis', defaults.basis) || null}
        error={state.fieldErrors.basis}
        options={[
          { value: 'on_request', label: 'Na wniosek z oceny' },
          { value: 'by_law', label: 'Z mocy prawa' },
        ]}
      />
      <Field id="evaluationId" label="Ocena" optional error={state.fieldErrors.evaluationId}>
        <Select name="evaluationId" defaultValue={value('evaluationId', defaults.evaluationId)}>
          <option value="">Bez oceny</option>
          {evaluations.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="grantedOn" label="Data przyznania" error={state.fieldErrors.grantedOn}>
        <DateInput name="grantedOn" defaultValue={value('grantedOn')} />
      </Field>
      <Field id="newGrade" label="Nowy stopień" error={state.fieldErrors.newGrade}>
        <Select name="newGrade" defaultValue={value('newGrade')}>
          <option value="">Wybierz stopień</option>
          {GRADES.map((grade) => (
            <option key={grade} value={grade}>
              {grade}
            </option>
          ))}
        </Select>
      </Field>
      <div>
        <SubmitButton pendingLabel="Trwa zapisywanie">Przyznaj stopień</SubmitButton>
      </div>
    </form>
  );
}
