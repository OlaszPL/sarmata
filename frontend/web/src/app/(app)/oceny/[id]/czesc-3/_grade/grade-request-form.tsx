'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { ErrorSummary, Field, Notice, RadioGroup, SubmitButton, Textarea } from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { saveGradeRequest } from '../actions';

interface GradeRequestFormProps {
  id: string;
  /** Roman numeral of the requested grade, the current grade plus one. */
  requestedGradeLabel: string;
  /** The saved request: `yes` with the motivation, or empty when none is saved. */
  saved: { request: 'yes' | null; motivation: string };
}

/** The grade request of part III: a yes or no choice and the motivation. */
export function GradeRequestForm({ id, requestedGradeLabel, saved }: GradeRequestFormProps) {
  const initial: FormState = { values: {}, fieldErrors: {} };
  const [state, action] = useActionState(saveGradeRequest.bind(null, id), initial);
  const errors = Object.entries(state.fieldErrors).flatMap(([fieldId, message]) =>
    message === undefined ? [] : [{ fieldId, message }],
  );
  const hasErrors = errors.length > 0 || state.formError !== undefined;
  useErrorTitle(hasErrors);

  const typedRequest = state.values.request;
  const typedMotivation = state.values.gradeRequestMotivation;
  const request = typeof typedRequest === 'string' ? typedRequest : saved.request;
  const motivation = typeof typedMotivation === 'string' ? typedMotivation : saved.motivation;

  return (
    <form action={action} noValidate className="flex flex-col gap-6">
      {hasErrors ? (
        <ErrorSummary title="Nie udało się zapisać części III" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      {state.ok ? (
        <Notice tone="success" role="status">
          <p>Zapisano część III.</p>
          <p>
            <Link href={routes.evaluationCheck(id)} className="text-link underline">
              Przejdź do sprawdzenia arkusza
            </Link>
          </p>
        </Notice>
      ) : null}
      <RadioGroup
        id="gradeRequest"
        name="request"
        legend="Czy składasz wniosek o stopień?"
        hint={`Wniosek dotyczy stopnia ${requestedGradeLabel}. Gdy zapiszesz Nie, wniosek nie trafi do arkusza.`}
        defaultValue={request}
        error={state.fieldErrors.gradeRequest}
        options={[
          { value: 'yes', label: 'Tak' },
          { value: 'no', label: 'Nie' },
        ]}
      />
      <Field
        id="gradeRequestMotivation"
        label="Umotywowanie wniosku"
        hint="Wypełnij, gdy składasz wniosek."
        error={state.fieldErrors.gradeRequestMotivation}
      >
        <Textarea name="gradeRequestMotivation" rows={6} defaultValue={motivation} />
      </Field>
      <div>
        <SubmitButton pendingLabel="Zapisuję">Zapisz część III</SubmitButton>
      </div>
    </form>
  );
}
