'use client';

import type { ReactNode } from 'react';
import {
  DateInput,
  Field,
  RadioGroup,
  Select,
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

const FORM_CLASS = 'flex flex-col gap-8';

/** Native disclosure that opens by itself when its form shows errors. */
function SideDetails({
  summary,
  open,
  children,
}: {
  summary: string;
  open: boolean;
  children: ReactNode;
}) {
  return (
    <details open={open} className="border-rule border-t border-b py-3">
      <summary className="font-heading text-ink cursor-pointer text-base leading-[normal] font-semibold">
        {summary}
      </summary>
      <div className="flex flex-col gap-8 pt-6">{children}</div>
    </details>
  );
}

export function AbsenceForm({ action, initial }: BaseProps) {
  const { state, formAction, hasErrors } = useCaseForm(action, initial);
  const prefix = 'absence';
  return (
    <SideDetails summary="Odnotuj nieobecność" open={hasErrors}>
      <FormErrors
        prefix={prefix}
        title="Popraw nieobecność"
        state={state}
        fields={['from', 'to']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="absence" />
        <Field id={`${prefix}-from`} label="Początek nieobecności" error={state.fieldErrors.from}>
          <DateInput name="from" defaultValue={textValue(state.values, 'from')} />
        </Field>
        <Field
          id={`${prefix}-to`}
          label="Koniec nieobecności"
          optional
          hint="Zostaw puste, jeśli nieobecność trwa"
          error={state.fieldErrors.to}
        >
          <DateInput name="to" defaultValue={textValue(state.values, 'to')} />
        </Field>
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
            Odnotuj nieobecność
          </SubmitButton>
        </div>
      </form>
    </SideDetails>
  );
}

export function ReturnForm({
  action,
  initial,
  absence,
}: BaseProps & { absence: { absenceId: string; from: string; fromText: string } }) {
  const { state, formAction, hasErrors } = useCaseForm(action, initial);
  const prefix = `return-${absence.absenceId}`;
  return (
    <SideDetails summary={`Odnotuj powrót z nieobecności od ${absence.fromText}`} open={hasErrors}>
      <FormErrors
        prefix={prefix}
        title="Popraw powrót z nieobecności"
        state={state}
        fields={['to']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="return" />
        <input type="hidden" name="absenceId" value={absence.absenceId} />
        <input type="hidden" name="from" value={absence.from} />
        <Field id={`${prefix}-to`} label="Data powrotu" error={state.fieldErrors.to}>
          <DateInput name="to" defaultValue={textValue(state.values, 'to')} />
        </Field>
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
            Odnotuj powrót
          </SubmitButton>
        </div>
      </form>
    </SideDetails>
  );
}

export function TermChangeForm({
  action,
  initial,
  reasons,
  hint,
}: BaseProps & { reasons: { value: string; label: string }[]; hint: string }) {
  const { state, formAction, hasErrors } = useCaseForm(action, initial);
  const prefix = 'term';
  return (
    <SideDetails summary="Zmień termin oceny" open={hasErrors}>
      <FormErrors
        prefix={prefix}
        title="Popraw zmianę terminu"
        state={state}
        fields={['newDueOn', 'reason', 'noticeOn']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="term" />
        <Field
          id={`${prefix}-newDueOn`}
          label="Nowy termin oceny"
          hint={hint}
          error={state.fieldErrors.newDueOn}
        >
          <DateInput name="newDueOn" defaultValue={textValue(state.values, 'newDueOn')} />
        </Field>
        <RadioGroup
          id={`${prefix}-reason`}
          name="reason"
          legend="Przyczyna zmiany terminu"
          defaultValue={textValue(state.values, 'reason') || null}
          error={state.fieldErrors.reason}
          options={reasons}
        />
        <Field
          id={`${prefix}-noticeOn`}
          label="Data zawiadomienia osoby ocenianej"
          error={state.fieldErrors.noticeOn}
        >
          <DateInput name="noticeOn" defaultValue={textValue(state.values, 'noticeOn')} />
        </Field>
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
            Zmień termin oceny
          </SubmitButton>
        </div>
      </form>
    </SideDetails>
  );
}

export function PositionChangeForm({ action, initial }: BaseProps) {
  const { state, formAction, hasErrors } = useCaseForm(action, initial);
  const prefix = 'position';
  return (
    <SideDetails summary="Odnotuj zmianę stanowiska" open={hasErrors}>
      <FormErrors
        prefix={prefix}
        title="Popraw zmianę stanowiska"
        state={state}
        fields={['changedOn', 'positionTitle', 'orgUnit', 'significant', 'justification']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="position" />
        <Field id={`${prefix}-changedOn`} label="Data zmiany" error={state.fieldErrors.changedOn}>
          <DateInput name="changedOn" defaultValue={textValue(state.values, 'changedOn')} />
        </Field>
        <Field
          id={`${prefix}-positionTitle`}
          label="Nowe stanowisko"
          optional
          error={state.fieldErrors.positionTitle}
        >
          <TextInput
            name="positionTitle"
            defaultValue={textValue(state.values, 'positionTitle')}
            className="max-w-[25rem]"
          />
        </Field>
        <Field
          id={`${prefix}-orgUnit`}
          label="Nowa komórka organizacyjna"
          optional
          error={state.fieldErrors.orgUnit}
        >
          <TextInput
            name="orgUnit"
            defaultValue={textValue(state.values, 'orgUnit')}
            className="max-w-[25rem]"
          />
        </Field>
        <RadioGroup
          id={`${prefix}-significant`}
          name="significant"
          legend="Czy zmieniły się istotnie obowiązki"
          defaultValue={textValue(state.values, 'significant') || null}
          error={state.fieldErrors.significant}
          options={[
            { value: 'yes', label: 'Tak, obowiązki zmieniły się istotnie' },
            { value: 'no', label: 'Nie, obowiązki zmieniły się nieistotnie' },
          ]}
        />
        <Field
          id={`${prefix}-justification`}
          label="Uzasadnienie"
          error={state.fieldErrors.justification}
        >
          <Textarea
            name="justification"
            rows={4}
            defaultValue={textValue(state.values, 'justification')}
          />
        </Field>
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
            Odnotuj zmianę stanowiska
          </SubmitButton>
        </div>
      </form>
    </SideDetails>
  );
}

export function EvaluatorChangeForm({
  action,
  initial,
  people,
}: BaseProps & { people: { accountId: string; name: string }[] }) {
  const { state, formAction, hasErrors } = useCaseForm(action, initial);
  const prefix = 'evaluator';
  return (
    <SideDetails summary="Zmień osobę oceniającą" open={hasErrors}>
      <FormErrors
        prefix={prefix}
        title="Popraw zmianę osoby oceniającej"
        state={state}
        fields={['accountId', 'occurredOn', 'reason']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="evaluator" />
        <Field
          id={`${prefix}-accountId`}
          label="Nowa osoba oceniająca"
          error={state.fieldErrors.accountId}
        >
          <Select
            name="accountId"
            defaultValue={textValue(state.values, 'accountId')}
            className="max-w-[25rem]"
          >
            <option value="">Wybierz osobę</option>
            {people.map((person) => (
              <option key={person.accountId} value={person.accountId}>
                {person.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field id={`${prefix}-occurredOn`} label="Data zmiany" error={state.fieldErrors.occurredOn}>
          <DateInput name="occurredOn" defaultValue={textValue(state.values, 'occurredOn')} />
        </Field>
        <Field id={`${prefix}-reason`} label="Powód zmiany" error={state.fieldErrors.reason}>
          <Textarea name="reason" rows={3} defaultValue={textValue(state.values, 'reason')} />
        </Field>
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
            Zmień osobę oceniającą
          </SubmitButton>
        </div>
      </form>
    </SideDetails>
  );
}

export function CorrectionForm({
  action,
  initial,
  criteria,
  scale,
}: BaseProps & {
  criteria: readonly { id: string; name: string; indicators: string[] }[];
  scale: readonly { value: number; label: string }[];
}) {
  const { state, formAction } = useCaseForm(action, initial);
  const prefix = 'correction';
  return (
    <div className={FORM_CLASS}>
      <FormErrors
        prefix={prefix}
        title="Popraw korektę arkusza"
        state={state}
        fields={[...sheetFieldIds(criteria), 'reason']}
      />
      <form action={formAction} noValidate className={FORM_CLASS}>
        <input type="hidden" name="form" value="correction" />
        <SheetFields
          idPrefix={prefix}
          criteria={criteria}
          scale={scale}
          values={state.values}
          fieldErrors={state.fieldErrors}
        />
        <Field id={`${prefix}-reason`} label="Powód korekty" error={state.fieldErrors.reason}>
          <Textarea name="reason" rows={3} defaultValue={textValue(state.values, 'reason')} />
        </Field>
        <div>
          <SubmitButton variant="secondary" pendingLabel="Trwa zapisywanie">
            Zapisz korektę arkusza
          </SubmitButton>
        </div>
      </form>
    </div>
  );
}
