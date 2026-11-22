'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ServiceError, servicesFor } from '@sarmata/services';
import type { z } from 'zod';
import { type CaseRegulation, criterionName } from '@/lib/case-regulation';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { regulationForEvaluation } from '@/lib/regulation';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';
import { fieldErrorsOf } from './action-errors';
import {
  absenceSchema,
  acquaintanceSchema,
  closingSchema,
  correctionSchema,
  evaluatorChangeSchema,
  interruptionSchema,
  objectionDecisionSchema,
  objectionFilingSchema,
  positionChangeSchema,
  returnSchema,
  sheetFromForm,
  termChangeSchema,
  witnessList,
} from './forms';
import type { SavedKey } from './panels';

type Services = ReturnType<typeof servicesFor>;

/** Thrown inside a call when the typed sheet fields are not complete, becomes form state. */
class SheetFieldErrors extends Error {
  constructor(readonly fieldErrors: Record<string, string>) {
    super('Sheet fields are incomplete');
  }
}

/** The sheet of an evaluation with the posted ratings, or throws the field errors to show. */
async function sheetOf(
  services: Services,
  id: string,
  values: ReturnType<typeof formValues>,
  keep: (r: CaseRegulation) => void,
) {
  const view = await services.evaluations.get(id);
  if (view === null) throw new ServiceError('not_found', `Evaluation ${id} not found`);
  keep(await regulationForEvaluation(view));
  const sheet = sheetFromForm(values, view.sheet.content, view.criteria);
  if ('fieldErrors' in sheet) throw new SheetFieldErrors(sheet.fieldErrors);
  return sheet.content;
}

/**
 * The whole flow of one event form: parse, call the service with the case regulation at hand (so
 * gate messages name the criteria), turn failures into form state and, on success, refresh the
 * case and redirect back to the tab with the `zapisano` message of `key`. The form name is kept in
 * `values.form`, so the page knows which `<details>` to open.
 */
async function caseAction<T>(
  id: string,
  key: SavedKey,
  formData: FormData,
  schema: z.ZodType<T>,
  run: (
    services: Services,
    data: T,
    keep: (r: CaseRegulation) => void,
    values: ReturnType<typeof formValues>,
  ) => Promise<unknown>,
): Promise<FormState> {
  const values = formValues(formData);
  if (!('form' in values)) values.form = key;

  const parsed = parseForm(schema, formData);
  if ('state' in parsed) return { ...parsed.state, values };

  let regulation: CaseRegulation | null = null;
  let failure: ServiceError | null = null;
  const services = servicesFor(await createSupabase());
  try {
    const result = await runService(
      async () => {
        try {
          await run(
            services,
            parsed.data,
            (loaded) => {
              regulation = loaded;
            },
            values,
          );
        } catch (error) {
          if (error instanceof ServiceError) failure = error;
          throw error;
        }
      },
      undefined,
      values,
      (criterionId) => (regulation ? criterionName(regulation, criterionId) : criterionId),
    );
    if (!result.ok) {
      const caught = failure as ServiceError | null;
      if (caught === null) return result.state;
      const formError = result.state.formError ?? serviceErrorMessage(caught.code, caught.details);
      return {
        ...result.state,
        fieldErrors: {
          ...fieldErrorsOf(caught.code, caught.details, formError),
          ...result.state.fieldErrors,
        },
      };
    }
  } catch (error) {
    if (error instanceof SheetFieldErrors) return { values, fieldErrors: error.fieldErrors };
    throw error;
  }

  revalidatePath(routes.evaluation(id), 'layout');
  redirect(`${routes.evaluationEvents(id)}?zapisano=${key}`);
}

type Action = (id: string, previous: FormState, formData: FormData) => Promise<FormState>;

/** Records the acquaintance with the sheet. A refusal to sign carries the note and witnesses. */
export const recordAcquaintance: Action = async (id, _previous, formData) =>
  caseAction(id, 'acquaintance', formData, acquaintanceSchema, async (services, data) => {
    const refused = data.signature === 'refused';
    const place = data.place.trim();
    const note = data.refusalNote.trim();
    const witnesses = witnessList(data.witnesses);
    await services.evaluations.transition(id, {
      type: 'record_acquaintance',
      acquaintedOn: data.acquaintedOn,
      signatureRefused: refused,
      ...(refused && note !== '' ? { refusalNote: note } : {}),
      ...(refused && witnesses.length > 0 ? { witnesses } : {}),
      ...(place === '' ? {} : { place }),
    });
  });

/** Closes the evaluation once the objection window has passed. */
export const closeEvaluation: Action = async (id, _previous, formData) =>
  caseAction(id, 'closing', formData, closingSchema, async (services, data) => {
    await services.evaluations.transition(id, {
      type: 'close_after_objection_window',
      closedOn: data.closedOn,
    });
  });

/** Files an objection to the evaluation. */
export const fileObjection: Action = async (id, _previous, formData) =>
  caseAction(id, 'objection', formData, objectionFilingSchema, async (services, data) => {
    await services.evaluations.transition(id, { type: 'file_objection', filedOn: data.filedOn });
  });

/** Records the decision on an objection. A changed outcome carries the new part II ratings. */
export const decideObjection: Action = async (id, _previous, formData) =>
  caseAction(
    id,
    'decision',
    formData,
    objectionDecisionSchema,
    async (services, data, keep, values) => {
      const content =
        data.outcome === 'changed' ? await sheetOf(services, id, values, keep) : undefined;
      await services.evaluations.decideObjection(id, {
        outcome: data.outcome,
        decidedOn: data.decidedOn,
        ...(content === undefined ? {} : { content }),
      });
    },
  );

/** Interrupts the evaluation with a reason. */
export const interruptEvaluation: Action = async (id, _previous, formData) =>
  caseAction(id, 'interruption', formData, interruptionSchema, async (services, data) => {
    await services.evaluations.transition(id, {
      type: 'interrupt',
      interruptedOn: data.interruptedOn,
      reason: data.reason,
    });
  });

/** Records an absence, open ended when there is no return date. */
export const recordAbsence: Action = async (id, _previous, formData) =>
  caseAction(id, 'absence', formData, absenceSchema, async (services, data) => {
    await services.evaluations.recordAbsence(id, { from: data.from, to: data.to });
  });

/** Completes an earlier absence with its return date. */
export const recordReturn: Action = async (id, _previous, formData) =>
  caseAction(id, 'return', formData, returnSchema, async (services, data) => {
    await services.evaluations.recordAbsence(id, {
      absenceId: data.absenceId,
      from: data.from,
      to: data.to,
    });
  });

/** Moves the due date of the evaluation. */
export const changeTerm: Action = async (id, _previous, formData) =>
  caseAction(id, 'term', formData, termChangeSchema, async (services, data) => {
    await services.evaluations.changeTerm(id, {
      newDueOn: data.newDueOn,
      reason: data.reason,
      noticeOn: data.noticeOn,
    });
  });

/** Records a change of the position of the evaluated person. */
export const recordPositionChange: Action = async (id, _previous, formData) =>
  caseAction(id, 'position', formData, positionChangeSchema, async (services, data) => {
    await services.evaluations.recordPositionChange(id, {
      changedOn: data.changedOn,
      significant: data.significant === 'yes',
      justification: data.justification,
      positionTitle: data.positionTitle,
      orgUnit: data.orgUnit,
    });
  });

/** Hands the evaluation to another evaluator. */
export const changeEvaluator: Action = async (id, _previous, formData) =>
  caseAction(id, 'evaluator', formData, evaluatorChangeSchema, async (services, data) => {
    await services.evaluations.changeEvaluator(id, {
      accountId: data.accountId,
      occurredOn: data.occurredOn,
      reason: data.reason,
    });
  });

/** Corrects the locked part II fields of the sheet, with a reason. */
export const correctSheet: Action = async (id, _previous, formData) =>
  caseAction(id, 'correction', formData, correctionSchema, async (services, data, keep, values) => {
    const content = await sheetOf(services, id, values, keep);
    await services.evaluations.correctSheet(id, { content, reason: data.reason });
  });
