'use client';

import Link from 'next/link';
import { Button, ErrorSummary, Field, Select, SubmitButton } from '@sarmata/ui';
import { useFormRound } from '@/lib/use-form-round';
import { useErrorTitle } from '@/components/use-error-title';
import { routes } from '@/lib/routes';
import { changeSupervisor } from './actions';

export interface SupervisorOption {
  id: string;
  label: string;
}

/** Choice of the supervisor of one employee. The current one is preselected. */
export function SupervisorForm({
  employeeId,
  currentSupervisorId,
  options,
}: {
  employeeId: string;
  currentSupervisorId: string | null;
  options: readonly SupervisorOption[];
}) {
  const [state, formAction] = useFormRound(changeSupervisor);

  const fieldError = state.fieldErrors.supervisorId;
  const errors = fieldError ? [{ fieldId: 'supervisorId', message: fieldError }] : [];
  const failed = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(failed);

  const chosen =
    typeof state.values.supervisorId === 'string'
      ? state.values.supervisorId
      : (currentSupervisorId ?? '');

  return (
    <form key={state.round} action={formAction} noValidate className="grid max-w-[46rem] gap-6">
      {failed ? (
        <ErrorSummary title="Nie udało się zmienić przełożonego" errors={errors}>
          {state.formError ? <p className="max-w-[70ch]">{state.formError}</p> : null}
        </ErrorSummary>
      ) : null}
      <input type="hidden" name="employeeId" value={employeeId} />
      <Field id="supervisorId" label="Przełożony" error={fieldError}>
        <Select name="supervisorId" defaultValue={chosen}>
          <option value="">Brak przełożonego</option>
          {options.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </Select>
      </Field>
      <div className="flex flex-wrap items-center gap-4">
        <SubmitButton pendingLabel="Trwa zapisywanie przełożonego">
          Zapisz przełożonego
        </SubmitButton>
        <Button asChild variant="secondary">
          <Link href={routes.hrTree}>Anuluj</Link>
        </Button>
      </div>
    </form>
  );
}
