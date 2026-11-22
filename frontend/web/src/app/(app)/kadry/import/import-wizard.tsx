'use client';

import { useActionState, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { ImportField, RowPreview } from '@sarmata/services';
import {
  Button,
  DataTable,
  ErrorSummary,
  Field,
  Notice,
  RadioGroup,
  Section,
  Select,
  SubmitButton,
  Tag,
  TextInput,
  type DataTableColumn,
} from '@sarmata/ui';
import { useErrorTitle } from '@/components/use-error-title';
import { actionLabels, importFieldKeys, importFieldLabels } from '@/lib/hr/import';
import { routes } from '@/lib/routes';
import { commitImport, dryRunImport, proposeImportMapping, type ImportState } from './actions';

const MAX_BYTES = 1024 * 1024;
const FILE_TOO_BIG = 'Plik jest za duży. Podziel go na części do 1 MB.';
const FILE_MISSING = 'Wybierz plik CSV';

const linkClasses = 'font-heading text-link font-medium underline';

const stepHeadings: Record<ImportState['step'], string> = {
  file: 'Plik CSV',
  mapping: 'Dopasowanie kolumn',
  preview: 'Przebieg próbny',
  done: 'Wynik',
};

/** Each step submits to its own server action, `step` in the form says which one. */
async function runStep(prev: ImportState, formData: FormData): Promise<ImportState> {
  switch (formData.get('step')) {
    case 'file':
      return proposeImportMapping(prev, formData);
    case 'mapping':
      return dryRunImport(prev, formData);
    case 'preview':
      return commitImport(prev, formData);
    default:
      return { step: 'file' };
  }
}

function fullName(values: Record<string, unknown>): string {
  const parts = [values.firstName, values.lastName].filter(
    (part): part is string => typeof part === 'string' && part !== '',
  );
  return parts.length > 0 ? parts.join(' ') : 'Brak';
}

function textOf(value: unknown): string {
  return typeof value === 'string' && value !== '' ? value : 'Brak';
}

/** Four steps of the employee import. The CSV text travels in a hidden field, nothing is stored between steps. */
export function ImportWizard() {
  const [state, formAction] = useActionState<ImportState, FormData>(runStep, { step: 'file' });
  const [fileError, setFileError] = useState<string | undefined>();

  const missing = state.step === 'mapping' ? state.proposal.missing : [];
  const hasSummary = fileError !== undefined || state.error !== undefined || missing.length > 0;
  useErrorTitle(hasSummary);

  // Focus follows the step. An error summary takes the focus itself.
  const shownStep = useRef(state.step);
  useEffect(() => {
    if (shownStep.current === state.step) return;
    shownStep.current = state.step;
    if (hasSummary) return;
    const heading = document.getElementById(`import-${state.step}-heading`);
    heading?.setAttribute('tabindex', '-1');
    heading?.focus();
  }, [state.step, hasSummary]);

  const restart = () => {
    setFileError(undefined);
    const data = new FormData();
    data.set('step', 'restart');
    formAction(data);
  };

  return (
    <div className="grid gap-6">
      {state.step === 'file' ? (
        <FileStep
          error={state.error}
          fileError={fileError}
          setFileError={setFileError}
          formAction={formAction}
        />
      ) : null}
      {state.step === 'mapping' ? <MappingStep state={state} formAction={formAction} /> : null}
      {state.step === 'preview' ? (
        <PreviewStep state={state} formAction={formAction} onRestart={restart} />
      ) : null}
      {state.step === 'done' ? <DoneStep state={state} onRestart={restart} /> : null}
    </div>
  );
}

function FileStep({
  error,
  fileError,
  setFileError,
  formAction,
}: {
  error: string | undefined;
  fileError: string | undefined;
  setFileError: (message: string | undefined) => void;
  formAction: (formData: FormData) => void;
}) {
  const items = fileError ? [{ fieldId: 'file', message: fileError }] : [];
  return (
    <Section id="import-file" title={stepHeadings.file}>
      <form
        noValidate
        className="grid max-w-[46rem] gap-6"
        action={async (formData) => {
          const file = formData.get('file');
          formData.delete('file');
          if (!(file instanceof File) || file.size === 0) {
            setFileError(FILE_MISSING);
            return;
          }
          if (file.size > MAX_BYTES) {
            setFileError(FILE_TOO_BIG);
            return;
          }
          setFileError(undefined);
          formData.set('csv', await file.text());
          formData.set('step', 'file');
          formAction(formData);
        }}
      >
        {error !== undefined || items.length > 0 ? (
          <ErrorSummary title="Nie udało się wczytać pliku" errors={items}>
            {error ? <p className="max-w-[70ch]">{error}</p> : null}
          </ErrorSummary>
        ) : null}
        <Field
          id="file"
          label="Plik z listą pracowników"
          hint="CSV z nagłówkiem, separator średnik albo przecinek, kodowanie UTF-8."
          error={fileError}
        >
          <TextInput type="file" name="file" accept=".csv,text/csv" className="h-auto py-2" />
        </Field>
        <div>
          <SubmitButton pendingLabel="Trwa sprawdzanie kolumn">Sprawdź kolumny</SubmitButton>
        </div>
      </form>
    </Section>
  );
}

function MappingStep({
  state,
  formAction,
}: {
  state: Extract<ImportState, { step: 'mapping' }>;
  formAction: (formData: FormData) => void;
}) {
  const { proposal } = state;
  const missingItems = proposal.missing.map((field) => ({
    fieldId: `map.${field}`,
    message: `Wskaż kolumnę dla pola: ${importFieldLabels[field]}`,
  }));
  return (
    <Section id="import-mapping" title={stepHeadings.mapping}>
      <form action={formAction} noValidate className="grid max-w-[46rem] gap-6">
        {missingItems.length > 0 || state.error ? (
          <ErrorSummary title="Nie można jeszcze sprawdzić pliku" errors={missingItems}>
            {state.error ? <p className="max-w-[70ch]">{state.error}</p> : null}
          </ErrorSummary>
        ) : null}
        <p className="max-w-[70ch]">
          Dla każdego pola wskaż kolumnę pliku, z której pochodzi. Imię i nazwisko są wymagane.
        </p>
        <input type="hidden" name="step" value="mapping" />
        <input type="hidden" name="csv" value={state.csv} />
        {importFieldKeys.map((field) => (
          <Field
            key={field}
            id={`map.${field}`}
            label={importFieldLabels[field]}
            error={proposal.missing.includes(field) ? 'Wskaż kolumnę dla tego pola' : undefined}
          >
            <Select name={`map.${field}`} defaultValue={proposal.mapping[field] ?? ''}>
              <option value="">Nie importuj</option>
              {proposal.headers.map((header) => (
                <option key={header} value={header}>
                  {header}
                </option>
              ))}
            </Select>
          </Field>
        ))}
        <div>
          <SubmitButton pendingLabel="Trwa przebieg próbny">Wykonaj przebieg próbny</SubmitButton>
        </div>
      </form>
    </Section>
  );
}

type PreviewState = Extract<ImportState, { step: 'preview' }>;

function PreviewStep({
  state,
  formAction,
  onRestart,
}: {
  state: PreviewState;
  formAction: (formData: FormData) => void;
  onRestart: () => void;
}) {
  const { preview, mapping } = state;
  const deciding = preview.rows.filter((row) => row.proposedAction === 'needs_decision');

  const columns: DataTableColumn<RowPreview>[] = [
    { key: 'row', header: 'Wiersz', cell: (row) => row.row, rowHeader: true },
    { key: 'name', header: 'Imię i nazwisko', cell: (row) => fullName(row.values) },
    { key: 'email', header: 'E-mail', cell: (row) => textOf(row.values.email) },
    {
      key: 'action',
      header: 'Działanie',
      cell: (row) => {
        const { label, tone } = actionLabels[row.proposedAction];
        return <Tag tone={tone}>{label}</Tag>;
      },
    },
    {
      key: 'notes',
      header: 'Uwagi',
      cell: (row) =>
        row.errors.length === 0 ? (
          'Brak'
        ) : (
          <ul className="grid gap-1">
            {row.errors.map((error) => (
              <li key={`${error.field ?? ''}:${error.message}`}>
                {error.field ? `${importFieldLabels[error.field]}: ` : ''}
                {error.message}
              </li>
            ))}
          </ul>
        ),
    },
  ];

  const summary = [
    ['create', preview.summary.create],
    ['update', preview.summary.update],
    ['needs_decision', preview.summary.needs_decision],
    ['invalid', preview.summary.invalid],
  ] as const;

  return (
    <Section id="import-preview" title={stepHeadings.preview}>
      <form action={formAction} noValidate className="grid gap-6">
        {state.error ? (
          <ErrorSummary title="Nie udało się zaimportować pracowników" errors={[]}>
            <p className="max-w-[70ch]">{state.error}</p>
          </ErrorSummary>
        ) : null}
        <input type="hidden" name="step" value="preview" />
        <input type="hidden" name="csv" value={state.csv} />
        {(Object.entries(mapping) as [ImportField, string][]).map(([field, header]) => (
          <input key={field} type="hidden" name={`map.${field}`} value={header} />
        ))}
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {summary.map(([action, count]) => (
            <li key={action} className="font-heading">
              {actionLabels[action].label}: <strong>{count}</strong>
            </li>
          ))}
        </ul>
        <DataTable
          caption="Wynik przebiegu próbnego"
          columns={columns}
          rows={preview.rows}
          rowKey={(row) => String(row.row)}
          empty={<p>Plik nie zawiera wierszy z danymi.</p>}
        />
        {deciding.length > 0 ? (
          <div className="grid gap-6">
            <p className="max-w-[70ch]">
              Te wiersze przypominają osoby, które już są w rejestrze. Bez decyzji wiersz nie
              zostanie zapisany.
            </p>
            {deciding.map((row) => (
              <RadioGroup
                key={row.row}
                name={`decision.${row.row}`}
                legend={`Wiersz ${row.row}: ${fullName(row.values)}`}
                options={[
                  { value: 'create', label: 'Dodaj jako nowego pracownika' },
                  { value: 'skip', label: 'Pomiń' },
                  ...(row.match.kind === 'similar' ? row.match.candidates : []).map(
                    (candidate) => ({
                      value: `update:${candidate.id}`,
                      label: `Zaktualizuj: ${candidate.firstName} ${candidate.lastName}`,
                      hint:
                        [candidate.positionTitle, candidate.orgUnit]
                          .filter((part) => part !== null)
                          .join(', ') || undefined,
                    }),
                  ),
                ]}
              />
            ))}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <SubmitButton pendingLabel="Trwa import pracowników">Zaimportuj pracowników</SubmitButton>
          <Button type="button" variant="link" onClick={onRestart}>
            Zacznij od nowa
          </Button>
        </div>
      </form>
    </Section>
  );
}

function DoneStep({
  state,
  onRestart,
}: {
  state: Extract<ImportState, { step: 'done' }>;
  onRestart: () => void;
}) {
  const { report } = state;
  return (
    <Section id="import-done" title={stepHeadings.done}>
      <div className="grid max-w-[46rem] gap-6">
        <Notice tone="success" role="status" title="Import zakończony">
          <ul className="grid gap-1">
            <li>Dodano nowych pracowników: {report.created}</li>
            <li>Zaktualizowano: {report.updated}</li>
            <li>Pominięto: {report.skipped}</li>
            <li>
              Bez decyzji, nie zapisano: {report.undecided.length}
              {report.undecided.length > 0 ? ` (wiersze ${report.undecided.join(', ')})` : ''}
            </li>
            <li>
              Błędy: {report.failed.length}
              {report.failed.length > 0 ? (
                <ul className="mt-1 grid gap-1 pl-5">
                  {report.failed.map((failure) => (
                    <li key={failure.row}>
                      Wiersz {failure.row}: {failure.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          </ul>
        </Notice>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <Link href={routes.hrTree} className={linkClasses}>
            Zobacz strukturę
          </Link>
          <Button type="button" variant="link" onClick={onRestart}>
            Zacznij od nowa
          </Button>
        </div>
      </div>
    </Section>
  );
}
