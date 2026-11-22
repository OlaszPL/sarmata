'use client';

import { useActionState, useState } from 'react';
import { ErrorSummary, Field, Select, SubmitButton, TextInput } from '@sarmata/ui';
import { type RegulationFormState, cloneVersion } from '@/app/(app)/ustawienia/przepisy/actions';
import { useErrorTitle } from '@/components/use-error-title';

const FIELD_ORDER = ['sourceId', 'name'];

const initialState: RegulationFormState = { values: {}, fieldErrors: {} };

/**
 * New draft from a published version. With `fixedSource` the source is that version (detail of a
 * published version), otherwise the admin picks one of `sources`.
 */
export function CloneForm({
  sources,
  defaultSourceId,
  fixedSource,
}: {
  sources?: readonly { value: string; label: string }[];
  defaultSourceId?: string;
  fixedSource?: { id: string; name: string };
}) {
  const [state, formAction] = useActionState(cloneVersion, initialState);
  // Each answer of the action remounts the form, so the default values show what was sent.
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }

  const errors = FIELD_ORDER.flatMap((fieldId) => {
    const message = state.fieldErrors[fieldId];
    return message ? [{ fieldId, message }] : [];
  });
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const text = (name: string, fallback = ''): string => {
    const value = state.values[name];
    return typeof value === 'string' ? value : fallback;
  };

  return (
    <div className="grid grid-cols-1 gap-8">
      {hasErrors ? (
        <ErrorSummary title="Popraw dane nowego szkicu" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form
        key={version}
        action={formAction}
        noValidate
        className="grid grid-cols-1 max-w-[40rem] gap-6"
      >
        {fixedSource ? (
          <>
            <input type="hidden" name="sourceId" value={fixedSource.id} />
            <p className="max-w-[70ch]">
              Szkic powstanie jako kopia wersji {fixedSource.name}. Potem zmienisz w nim parametry.
            </p>
          </>
        ) : (
          <Field
            id="sourceId"
            label="Wersja, na której opierasz szkic"
            hint="Szkic powstanie jako kopia tej wersji. Potem zmienisz w nim parametry."
            error={state.fieldErrors.sourceId}
          >
            <Select name="sourceId" defaultValue={text('sourceId', defaultSourceId ?? '')}>
              <option value="">Wybierz wersję</option>
              {(sources ?? []).map((source) => (
                <option key={source.value} value={source.value}>
                  {source.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field
          id="name"
          label="Nazwa nowej wersji"
          hint="Pod tą nazwą wersja pojawi się na liście."
          error={state.fieldErrors.name}
        >
          <TextInput name="name" autoComplete="off" defaultValue={text('name')} />
        </Field>
        <div>
          <SubmitButton pendingLabel="Tworzenie szkicu">Utwórz szkic</SubmitButton>
        </div>
      </form>
    </div>
  );
}
