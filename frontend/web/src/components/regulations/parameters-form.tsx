'use client';

import { type MouseEvent, useActionState, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import {
  Checkbox,
  ErrorSummary,
  Field,
  Select,
  SubmitButton,
  Textarea,
  TextInput,
} from '@sarmata/ui';
import { type RegulationFormState, saveParameters } from '@/app/(app)/ustawienia/przepisy/actions';
import { useErrorTitle } from '@/components/use-error-title';
import type { FormValues } from '@/lib/form-action';
import {
  type RegulationField,
  type RegulationFieldGroup,
  issueSummaryText,
} from '@/lib/regulations/regulation-form';

/** Summary lines in page order, each with its group and control so equal labels stay apart. */
function summaryItems(
  groups: readonly RegulationFieldGroup[],
  fieldErrors: RegulationFormState['fieldErrors'],
): { fieldId: string; message: string }[] {
  const items: { fieldId: string; message: string }[] = [];
  const known = new Set<string>();
  for (const group of groups) {
    for (const field of group.fields) {
      known.add(field.id);
      const message = fieldErrors[field.id];
      if (message)
        items.push({ fieldId: field.id, message: issueSummaryText(group, field, message) });
    }
  }
  for (const [fieldId, message] of Object.entries(fieldErrors)) {
    if (message && !known.has(fieldId)) items.push({ fieldId, message });
  }
  return items;
}

/** Opens the closed deadline group of a field before an error summary link focuses it. */
function openGroupOfErrorLink(event: MouseEvent<HTMLElement>): void {
  if (!(event.target instanceof Element)) return;
  const href = event.target.closest('a')?.getAttribute('href');
  if (!href?.startsWith('#') || href.length < 2) return;
  const details = document.getElementById(decodeURIComponent(href.slice(1)))?.closest('details');
  if (details) details.open = true;
}

/** The parameters of a draft (`/ustawienia/przepisy?wersja=`). Saving runs the worked examples. */
export function ParametersForm({
  versionId,
  groups,
  initialValues,
}: {
  versionId: string;
  groups: readonly RegulationFieldGroup[];
  initialValues: FormValues;
}) {
  const [state, formAction] = useActionState(saveParameters, {
    values: initialValues,
    fieldErrors: {},
  } satisfies RegulationFormState);
  // Each answer of the action remounts the form, so the default values show what was sent.
  const [shownState, setShownState] = useState(state);
  const [version, setVersion] = useState(0);
  if (state !== shownState) {
    setShownState(state);
    setVersion((current) => current + 1);
  }

  const errors = summaryItems(groups, state.fieldErrors);
  const hasErrors = errors.length > 0 || Boolean(state.formError);
  useErrorTitle(hasErrors);

  return (
    <div className="grid grid-cols-1 gap-8" onClickCapture={openGroupOfErrorLink}>
      {hasErrors ? (
        <ErrorSummary title="Popraw parametry wersji" errors={errors}>
          {state.formError}
        </ErrorSummary>
      ) : null}
      <form key={version} action={formAction} noValidate className="grid grid-cols-1 gap-10">
        <input type="hidden" name="versionId" value={versionId} />
        <ParameterGroups groups={groups} state={state} />
        <div>
          <SubmitButton pendingLabel="Zapisywanie i testy">Zapisz i uruchom testy</SubmitButton>
        </div>
      </form>
    </div>
  );
}

/** The groups of controls. Remounts with the form, so the shown strategies follow the posted values. */
function ParameterGroups({
  groups,
  state,
}: {
  groups: readonly RegulationFieldGroup[];
  state: RegulationFormState;
}) {
  const text = (field: RegulationField): string => {
    const value = state.values[field.id];
    return typeof value === 'string' ? value : field.value;
  };
  // The first values hold every checkbox. A posted form leaves out an unchecked one (visible, so
  // false) and a hidden one (disabled, so its saved value).
  const checkedOf = (field: RegulationField, visible: boolean): boolean => {
    if (field.id in state.values) return state.values[field.id] === '1';
    return visible ? false : field.value === '1';
  };
  const [strategies, setStrategies] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const group of groups) {
      for (const field of group.fields) {
        if (field.strategyOf)
          initial[field.strategyOf.slotField] ??= valueOf(
            groups,
            state,
            field.strategyOf.slotField,
          );
      }
    }
    return initial;
  });

  return (
    <>
      {groups.map((group) => {
        const hasBasisField = group.fields.some((field) => field.kind === 'text');
        const isSlot = group.fields.some((field) => field.id.startsWith('deadlines.'));
        const hasError = group.fields.some((field) => state.fieldErrors[field.id]);
        const body = (
          <fieldset className="min-w-0 max-w-[40rem]">
            <legend
              className={
                isSlot
                  ? 'sr-only'
                  : 'font-heading text-ink mb-2 text-[1.375rem] leading-[normal] font-semibold'
              }
            >
              {group.title}
            </legend>
            {group.basis && !hasBasisField ? (
              <p className="text-ink-muted mb-6 max-w-[70ch]">Podstawa prawna: {group.basis}</p>
            ) : null}
            <div className="mt-4 grid gap-6">
              {group.fields.map((field) => {
                const visible =
                  !field.strategyOf ||
                  field.strategyOf.strategies.includes(
                    strategies[field.strategyOf.slotField] ?? '',
                  );
                const onStrategyChange = group.fields.some(
                  (other) => other.strategyOf?.slotField === field.id,
                )
                  ? (value: string) => {
                      setStrategies((current) => ({ ...current, [field.id]: value }));
                    }
                  : undefined;
                return (
                  <div key={field.id} hidden={!visible}>
                    <FieldControl
                      field={field}
                      value={text(field)}
                      checked={checkedOf(field, visible)}
                      error={state.fieldErrors[field.id]}
                      disabled={!visible}
                      onStrategyChange={onStrategyChange}
                    />
                  </div>
                );
              })}
            </div>
          </fieldset>
        );
        if (!isSlot) {
          return (
            <div key={group.title} className="border-rule border-t pt-6">
              {body}
            </div>
          );
        }
        return (
          <details key={group.title} open={hasError} className="group border-rule border-t pt-6">
            <summary className="flex cursor-pointer list-none flex-wrap items-baseline gap-x-3 gap-y-1 focus-visible:outline-[3px] focus-visible:outline-offset-2 focus-visible:outline-[var(--focus)] focus-visible:outline-solid [&::-webkit-details-marker]:hidden">
              <ChevronRight
                aria-hidden
                className="text-ink size-5 shrink-0 self-center transition-transform group-open:rotate-90"
              />
              <span className="font-heading text-ink text-[1.375rem] leading-[normal] font-semibold">
                {group.title}
              </span>
              <span className="text-ink-muted">{slotSummary(group, text)}</span>
            </summary>
            <div className="mt-4">{body}</div>
          </details>
        );
      })}
    </>
  );
}

/** A short current value of a deadline slot, e.g. `Dni od zdarzenia, 7, od: Zapoznanie z oceną`. */
function slotSummary(
  group: RegulationFieldGroup,
  text: (field: RegulationField) => string,
): string {
  const byId = (suffix: string) => group.fields.find((field) => field.id.endsWith(suffix));
  const optionLabel = (field: RegulationField | undefined): string => {
    if (!field) return '';
    const value = text(field);
    return field.options?.find((option) => option.value === value)?.label ?? value;
  };
  const strategyField = byId('.strategy');
  const strategy = strategyField ? text(strategyField) : '';
  const numberOf = (suffix: string): string => {
    const field = byId(suffix);
    return field ? text(field).trim() : '';
  };
  const amount =
    strategy === 'monthsFromEvent'
      ? numberOf('.months')
      : strategy === 'daysFromEvent'
        ? numberOf('.days')
        : strategy === 'windowAroundEvent'
          ? `${numberOf('.daysBefore')} przed, ${numberOf('.daysAfter')} po`
          : '';
  const event = optionLabel(byId('.event'));
  return [optionLabel(strategyField), amount, event ? `od: ${event}` : '']
    .filter((part) => part !== '')
    .join(', ');
}

function valueOf(
  groups: readonly RegulationFieldGroup[],
  state: RegulationFormState,
  id: string,
): string {
  const value = state.values[id];
  if (typeof value === 'string') return value;
  for (const group of groups) {
    const field = group.fields.find((candidate) => candidate.id === id);
    if (field) return field.value;
  }
  return '';
}

function FieldControl({
  field,
  value,
  checked,
  error,
  disabled,
  onStrategyChange,
}: {
  field: RegulationField;
  value: string;
  checked: boolean;
  error: string | undefined;
  disabled: boolean;
  onStrategyChange: ((value: string) => void) | undefined;
}) {
  if (field.kind === 'checkbox') {
    return (
      <Checkbox
        id={field.id}
        name={field.id}
        value="1"
        label={field.label}
        hint={field.hint}
        defaultChecked={checked}
        error={error}
        disabled={disabled}
      />
    );
  }
  return (
    <Field id={field.id} label={field.label} hint={field.hint} error={error}>
      {field.kind === 'select' ? (
        <Select
          name={field.id}
          defaultValue={value}
          disabled={disabled}
          onChange={
            onStrategyChange
              ? (event) => {
                  onStrategyChange(event.target.value);
                }
              : undefined
          }
        >
          {(field.options ?? []).map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </Select>
      ) : field.kind === 'text' ? (
        <Textarea name={field.id} rows={3} defaultValue={value} disabled={disabled} />
      ) : (
        <TextInput
          name={field.id}
          inputMode={field.decimal ? 'decimal' : 'numeric'}
          autoComplete="off"
          className="max-w-[8rem]"
          defaultValue={value}
          disabled={disabled}
        />
      )}
    </Field>
  );
}
