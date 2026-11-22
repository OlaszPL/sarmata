'use client';

import { useActionState } from 'react';
import { ErrorSummary, Field, SubmitButton, Textarea } from '@sarmata/ui';
import { askQuestion } from '@/app/(app)/pomoc/actions';
import { useErrorTitle } from '@/components/use-error-title';
import { type FormState } from '@/lib/form-action';
import { QUESTION_MAX } from '@/lib/help/question';

const initialState: FormState = { values: {}, fieldErrors: {} };

/** The question to the procedure assistant. The values stay after an error. */
export function AskForm({ defaultQuestion }: { defaultQuestion: string }) {
  const [state, formAction] = useActionState(askQuestion, initialState);
  const fieldError = state.fieldErrors.question;
  const hasErrors = Boolean(fieldError) || Boolean(state.formError);
  useErrorTitle(hasErrors);

  const typed = state.values.question;
  const value = typeof typed === 'string' ? typed : defaultQuestion;

  return (
    <div className="grid gap-6">
      {hasErrors ? (
        <ErrorSummary
          title="Popraw pytanie"
          errors={fieldError ? [{ fieldId: 'question', message: fieldError }] : []}
        >
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form action={formAction} noValidate className="grid max-w-[40rem] gap-6">
        <Field
          id="question"
          label="Twoje pytanie o przepisy"
          hint="Na przykład: ile dni ma pracownik na sprzeciw od oceny?"
          {...(fieldError ? { error: fieldError } : {})}
        >
          <Textarea
            name="question"
            // The key resets the field when the server hands back what was typed.
            key={value}
            defaultValue={value}
            maxLength={QUESTION_MAX}
            showCount
            rows={4}
          />
        </Field>
        <div>
          <SubmitButton pendingLabel="Wysyłanie pytania">Zadaj pytanie</SubmitButton>
        </div>
      </form>
    </div>
  );
}
