'use client';

import { useState } from 'react';
import {
  Checkbox,
  DateInput,
  Field,
  Notice,
  RadioGroup,
  SubmitButton,
  TextInput,
  Textarea,
} from '@sarmata/ui';
import type { FormState } from '@/lib/form-action';
import { type CaseAction, FormErrors, textValue, useCaseForm } from './case-form';
import { SheetFields, sheetFieldIds } from './sheet-fields';

interface BaseProps {
  action: CaseAction;
  initial: FormState;
}

interface SheetProps {
  criteria: readonly { id: string; name: string; indicators: string[] }[];
  scale: readonly { value: number; label: string }[];
}

const FORM_CLASS = 'flex flex-col gap-8';

export function AcquaintanceForm({ action, initial }: BaseProps) {
  const { state, formAction } = useCaseForm(action, initial);
  const prefix = 'acquaintance';
  const [signature, setSignature] = useState(textValue(state.values, 'signature'));
  return (
    <div className={FORM_CLASS}>
      <FormErrors
        prefix={prefix}
        title="Popraw zapoznanie z oceną"
        state={state}
        fields={['acquaintedOn', 'signature', 'refusalNote', 'witnesses', 'place']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="acquaintance" />
        <Field
          id={`${prefix}-acquaintedOn`}
          label="Data zapoznania osoby ocenianej z oceną"
          error={state.fieldErrors.acquaintedOn}
        >
          <DateInput name="acquaintedOn" defaultValue={textValue(state.values, 'acquaintedOn')} />
        </Field>
        <RadioGroup
          id={`${prefix}-signature`}
          name="signature"
          legend="Czy osoba oceniana podpisała zapoznanie"
          defaultValue={textValue(state.values, 'signature') || null}
          onChange={setSignature}
          error={state.fieldErrors.signature}
          options={[
            { value: 'signed', label: 'Tak, osoba oceniana podpisała' },
            { value: 'refused', label: 'Nie, osoba oceniana odmówiła podpisu' },
          ]}
        />
        {signature === 'refused' ? (
          <>
            <Field
              id={`${prefix}-refusalNote`}
              label="Adnotacja o odmowie podpisu"
              optional
              hint="Zostaw puste, a wpiszemy adnotację ze wzoru arkusza"
              error={state.fieldErrors.refusalNote}
            >
              <Textarea
                name="refusalNote"
                rows={3}
                defaultValue={textValue(state.values, 'refusalNote')}
              />
            </Field>
            <Field
              id={`${prefix}-witnesses`}
              label="Osoby obecne przy odmowie (opcjonalnie)"
              hint="Jedna osoba w wierszu"
              error={state.fieldErrors.witnesses}
            >
              <Textarea
                name="witnesses"
                rows={3}
                defaultValue={textValue(state.values, 'witnesses')}
              />
            </Field>
          </>
        ) : null}
        <Field
          id={`${prefix}-place`}
          label="Miejscowość"
          optional
          hint="Zostaw puste, a użyjemy domyślnej miejscowości urzędu"
          error={state.fieldErrors.place}
        >
          <TextInput
            name="place"
            autoComplete="address-level2"
            defaultValue={textValue(state.values, 'place')}
            className="max-w-[25rem]"
          />
        </Field>
        <div>
          <SubmitButton pendingLabel="Trwa zapisywanie">Odnotuj zapoznanie</SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function ClosingForm({ action, initial, dueText }: BaseProps & { dueText: string | null }) {
  const { state, formAction } = useCaseForm(action, initial);
  const prefix = 'closing';
  return (
    <div className={FORM_CLASS}>
      <FormErrors
        prefix={prefix}
        title="Popraw zamknięcie oceny"
        state={state}
        fields={['closedOn']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="closing" />
        <Field
          id={`${prefix}-closedOn`}
          label="Data zamknięcia oceny"
          hint={dueText ? `Termin na sprzeciw mija ${dueText}` : undefined}
          error={state.fieldErrors.closedOn}
        >
          <DateInput name="closedOn" defaultValue={textValue(state.values, 'closedOn')} />
        </Field>
        <div>
          <SubmitButton pendingLabel="Trwa zamykanie">Zamknij ocenę</SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function ObjectionFilingForm({
  action,
  initial,
  dueText,
}: BaseProps & { dueText: string | null }) {
  const { state, formAction } = useCaseForm(action, initial);
  const prefix = 'objection';
  return (
    <div className={FORM_CLASS}>
      <FormErrors
        prefix={prefix}
        title="Popraw wniesienie sprzeciwu"
        state={state}
        fields={['filedOn']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="objection" />
        <Field
          id={`${prefix}-filedOn`}
          label="Data wniesienia sprzeciwu"
          hint={dueText ? `Sprzeciw można wnieść do ${dueText}` : undefined}
          error={state.fieldErrors.filedOn}
        >
          <DateInput name="filedOn" defaultValue={textValue(state.values, 'filedOn')} />
        </Field>
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
            Odnotuj wniesienie sprzeciwu
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function ObjectionDecisionForm({
  action,
  initial,
  criteria,
  scale,
  currentLevel,
}: BaseProps & SheetProps & { currentLevel: string | null }) {
  const { state, formAction } = useCaseForm(action, initial);
  const prefix = 'decision';
  const [outcome, setOutcome] = useState(textValue(state.values, 'outcome'));
  return (
    <div className={FORM_CLASS}>
      <FormErrors
        prefix={prefix}
        title="Popraw wynik sprzeciwu"
        state={state}
        fields={['decidedOn', 'outcome', ...sheetFieldIds(criteria)]}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="decision" />
        <Field
          id={`${prefix}-decidedOn`}
          label="Data rozpatrzenia sprzeciwu"
          error={state.fieldErrors.decidedOn}
        >
          <DateInput name="decidedOn" defaultValue={textValue(state.values, 'decidedOn')} />
        </Field>
        <RadioGroup
          id={`${prefix}-outcome`}
          name="outcome"
          legend="Wynik rozpatrzenia sprzeciwu"
          defaultValue={textValue(state.values, 'outcome') || null}
          onChange={setOutcome}
          error={state.fieldErrors.outcome}
          options={[
            {
              value: 'rejected',
              label: 'Sprzeciw nieuwzględniony',
              hint: 'Ocena zostaje i zostaje zamknięta',
            },
            {
              value: 'changed',
              label: 'Zmiana oceny',
              hint: 'Wpiszesz nową wersję arkusza, poziom oceny nie może spaść',
            },
            {
              value: 'redraft',
              label: 'Ponowne sporządzenie oceny',
              hint: 'Arkusz wraca do osoby oceniającej, etap rozmowy oceniającej',
            },
          ]}
        />
        {outcome === 'changed' ? (
          <>
            {currentLevel ? (
              <Notice tone="info" title="Obecna ocena">
                Poziom obecnej oceny to {currentLevel}. Nowa ocena nie może być niższa.
              </Notice>
            ) : null}
            <SheetFields
              idPrefix={prefix}
              criteria={criteria}
              scale={scale}
              values={state.values}
              fieldErrors={state.fieldErrors}
            />
          </>
        ) : null}
        <div>
          <SubmitButton pendingLabel="Trwa zapisywanie">Zapisz wynik sprzeciwu</SubmitButton>
        </div>
      </form>
    </div>
  );
}

export function InterruptionForm({ action, initial }: BaseProps) {
  const { state, formAction } = useCaseForm(action, initial);
  const prefix = 'interruption';
  return (
    <div className={FORM_CLASS}>
      <FormErrors
        prefix={prefix}
        title="Popraw przerwanie oceny"
        state={state}
        fields={['interruptedOn', 'reason', 'confirm']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="interruption" />
        <Field
          id={`${prefix}-interruptedOn`}
          label="Data przerwania oceny"
          error={state.fieldErrors.interruptedOn}
        >
          <DateInput name="interruptedOn" defaultValue={textValue(state.values, 'interruptedOn')} />
        </Field>
        <Field id={`${prefix}-reason`} label="Powód przerwania" error={state.fieldErrors.reason}>
          <Textarea name="reason" rows={4} defaultValue={textValue(state.values, 'reason')} />
        </Field>
        <Checkbox
          id={`${prefix}-confirm`}
          name="confirm"
          value="yes"
          label="Rozumiem, że przerwanej oceny nie można wznowić"
          defaultChecked={textValue(state.values, 'confirm') === 'yes'}
          error={state.fieldErrors.confirm}
        />
        <div>
          <SubmitButton variant="danger" pendingLabel="Trwa przerywanie">
            Przerwij ocenę
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
