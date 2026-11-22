'use client';

import { useActionState, useState } from 'react';
import {
  Checkbox,
  ErrorSummary,
  Field,
  Notice,
  RadioGroup,
  Section,
  SubmitButton,
  Textarea,
  TextInput,
} from '@sarmata/ui';
import { type OfficeSettingsState, saveOfficeSettings } from '@/app/(app)/ustawienia/actions';
import { useErrorTitle } from '@/components/use-error-title';
import { pluralPl } from '@/lib/format';
import type { FormValues } from '@/lib/form-action';

/** Order of the controls on the page, so the error summary lists them top to bottom. */
const FIELD_ORDER = [
  'aiEnabled',
  'notesRetentionMonths',
  'retentionConfirmed',
  'reminderLeadDays',
  'evaluationVisibility',
  'defaultPlace',
  'objectionAddresseeSheetA',
  'minEvaluations',
  'centralSharePercent',
  'leniencyPoints',
  'appreciationGapDays',
  'smtpHost',
  'smtpPort',
  'smtpUser',
  'smtpFrom',
];

function summaryItems(state: OfficeSettingsState): { fieldId: string; message: string }[] {
  const known = new Set(FIELD_ORDER);
  const keys = [...FIELD_ORDER, ...Object.keys(state.fieldErrors).filter((key) => !known.has(key))];
  const items: { fieldId: string; message: string }[] = [];
  for (const key of keys) {
    const message = state.fieldErrors[key];
    if (message) items.push({ fieldId: key, message });
  }
  return items;
}

const visibilityOptions = [
  {
    value: 'office',
    label: 'Cały urząd widzi oceny według ról',
    hint: 'Kadry i oceniający widzą oceny według swoich uprawnień.',
  },
  {
    value: 'tree',
    label: 'Przełożeni widzą oceny swoich podwładnych',
    hint: 'Oceniający widzi oceny osób ze swojej struktury.',
  },
] as const;

const aiOptions = [
  { value: '1', label: 'Włączone' },
  { value: '0', label: 'Wyłączone' },
] as const;

/** The office settings form (`/ustawienia`). `smtpPasswordForm` is the separate SMTP password form, shown under this one. */
export function OfficeSettingsForm({
  initialValues,
  smtpPasswordForm,
}: {
  initialValues: FormValues;
  smtpPasswordForm: React.ReactNode;
}) {
  const [state, formAction] = useActionState(saveOfficeSettings, {
    values: initialValues,
    fieldErrors: {},
  } satisfies OfficeSettingsState);
  // Each answer of the action remounts the form, so the default values show what was sent.
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }

  const errors = summaryItems(state);
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);
  const { fieldErrors } = state;
  const text = (name: string): string => {
    const value = state.values[name];
    return typeof value === 'string' ? value : '';
  };
  const retention = state.retention;

  return (
    <div className="grid gap-8">
      {hasErrors ? (
        <ErrorSummary title="Popraw ustawienia urzędu" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form key={version} action={formAction} noValidate className="grid max-w-[40rem] gap-10">
        <Section title="Sztuczna inteligencja" titleLevel={2} flush>
          <RadioGroup
            name="aiEnabled"
            legend="Sugestie AI w urzędzie"
            hint="Po wyłączeniu nikt w urzędzie nie uruchomi sugestii AI. Dotychczasowe przebiegi zostają w dzienniku."
            options={aiOptions}
            defaultValue={text('aiEnabled') || '1'}
            error={fieldErrors.aiEnabled}
          />
        </Section>

        <Section title="Przechowywanie notatek" titleLevel={2} flush>
          <div className="grid gap-6">
            <Field
              id="notesRetentionMonths"
              label="Okres przechowywania notatek w miesiącach"
              hint="Notatki starsze niż ta liczba miesięcy usuwa nocne zadanie."
              error={fieldErrors.notesRetentionMonths}
            >
              <TextInput
                name="notesRetentionMonths"
                inputMode="numeric"
                autoComplete="off"
                className="max-w-[8rem]"
                defaultValue={text('notesRetentionMonths')}
              />
            </Field>
            {retention ? (
              <Notice tone="warning" title="Krótszy okres usunie dane" role="status">
                <p className="max-w-[70ch]">
                  Przy tym okresie nocne zadanie usunie {retention.notes}{' '}
                  {pluralPl(retention.notes, 'notatkę', 'notatki', 'notatek')} i {retention.aiRuns}{' '}
                  {pluralPl(retention.aiRuns, 'przebieg AI', 'przebiegi AI', 'przebiegów AI')}. Tego
                  nie da się cofnąć.
                </p>
                <Checkbox
                  id="retentionConfirmed"
                  name="retentionConfirmed"
                  value="1"
                  label={`Rozumiem, że nocne zadanie usunie ${retention.notes} ${pluralPl(retention.notes, 'notatkę', 'notatki', 'notatek')} i ${retention.aiRuns} ${pluralPl(retention.aiRuns, 'przebieg AI', 'przebiegi AI', 'przebiegów AI')}`}
                  defaultChecked={state.values.retentionConfirmed === '1'}
                  error={fieldErrors.retentionConfirmed}
                  className="mt-4"
                />
              </Notice>
            ) : null}
          </div>
        </Section>

        <Section title="Przypomnienia" titleLevel={2} flush>
          <Field
            id="reminderLeadDays"
            label="Dni przed terminem"
            hint="Liczby dni przed terminem oddzielone przecinkami, na przykład 30, 14, 7. Od 1 do 5 liczb z zakresu 1 do 90."
            error={fieldErrors.reminderLeadDays}
          >
            <TextInput
              name="reminderLeadDays"
              autoComplete="off"
              defaultValue={text('reminderLeadDays')}
            />
          </Field>
        </Section>

        <Section title="Widoczność ocen" titleLevel={2} flush>
          <RadioGroup
            name="evaluationVisibility"
            legend="Kto widzi oceny"
            options={visibilityOptions}
            defaultValue={text('evaluationVisibility') || 'office'}
            error={fieldErrors.evaluationVisibility}
          />
        </Section>

        <Section title="Dokumenty" titleLevel={2} flush>
          <div className="grid gap-6">
            <Field
              id="defaultPlace"
              label="Domyślna miejscowość"
              optional
              error={fieldErrors.defaultPlace}
            >
              <TextInput name="defaultPlace" defaultValue={text('defaultPlace')} />
            </Field>
            <Field
              id="objectionAddresseeSheetA"
              label="Adresat sprzeciwu dla arkusza A"
              hint="Puste pole oznacza adresata z przepisów."
              optional
              error={fieldErrors.objectionAddresseeSheetA}
            >
              <Textarea
                name="objectionAddresseeSheetA"
                rows={3}
                defaultValue={text('objectionAddresseeSheetA')}
              />
            </Field>
          </div>
        </Section>

        <Section title="Flagi oceniających w statystykach" titleLevel={2} flush>
          <div className="grid gap-6">
            <Field
              id="minEvaluations"
              label="Najmniej ocen oceniającego w roku"
              hint="Od 1 do 1000. Poniżej tej liczby flagi się nie pokazują."
              error={fieldErrors.minEvaluations}
            >
              <TextInput
                name="minEvaluations"
                inputMode="numeric"
                autoComplete="off"
                className="max-w-[8rem]"
                defaultValue={text('minEvaluations')}
              />
            </Field>
            <Field
              id="centralSharePercent"
              label="Udział środkowego poziomu w procentach"
              hint="Od 50 do 100. Od tego udziału oceniający dostaje flagę tendencji centralnej."
              error={fieldErrors.centralSharePercent}
            >
              <TextInput
                name="centralSharePercent"
                inputMode="numeric"
                autoComplete="off"
                className="max-w-[8rem]"
                defaultValue={text('centralSharePercent')}
              />
            </Field>
            <Field
              id="leniencyPoints"
              label="Odchylenie od średniej urzędu w punktach"
              hint="Od 0,1 do 4. Od tej odległości oceniający dostaje flagę łagodności."
              error={fieldErrors.leniencyPoints}
            >
              <TextInput
                name="leniencyPoints"
                inputMode="decimal"
                autoComplete="off"
                className="max-w-[8rem]"
                defaultValue={text('leniencyPoints')}
              />
            </Field>
            <Field
              id="appreciationGapDays"
              label="Dni bez docenienia, po których oceniający dostaje sygnał"
              hint="Od 1 do 365."
              error={fieldErrors.appreciationGapDays}
            >
              <TextInput
                name="appreciationGapDays"
                inputMode="numeric"
                autoComplete="off"
                className="max-w-[8rem]"
                defaultValue={text('appreciationGapDays')}
              />
            </Field>
          </div>
        </Section>

        <Section title="Poczta SMTP" titleLevel={2} flush>
          <div className="grid gap-6">
            <Field id="smtpHost" label="Serwer" optional error={fieldErrors.smtpHost}>
              <TextInput
                name="smtpHost"
                autoComplete="off"
                spellCheck={false}
                defaultValue={text('smtpHost')}
              />
            </Field>
            <Field
              id="smtpPort"
              label="Port"
              hint="Od 1 do 65535."
              optional
              error={fieldErrors.smtpPort}
            >
              <TextInput
                name="smtpPort"
                inputMode="numeric"
                autoComplete="off"
                className="max-w-[8rem]"
                defaultValue={text('smtpPort')}
              />
            </Field>
            <Field id="smtpUser" label="Użytkownik" optional error={fieldErrors.smtpUser}>
              <TextInput
                name="smtpUser"
                autoComplete="off"
                spellCheck={false}
                defaultValue={text('smtpUser')}
              />
            </Field>
            <Field id="smtpFrom" label="Adres nadawcy" optional error={fieldErrors.smtpFrom}>
              <TextInput
                name="smtpFrom"
                type="email"
                autoComplete="off"
                spellCheck={false}
                defaultValue={text('smtpFrom')}
              />
            </Field>
          </div>
        </Section>

        <div>
          <SubmitButton pendingLabel="Zapisywanie">Zapisz ustawienia urzędu</SubmitButton>
        </div>
      </form>
      {smtpPasswordForm}
    </div>
  );
}
