'use server';

import {
  ServiceError,
  servicesFor,
  type ColumnMapping,
  type ImportPreview,
  type ImportReport,
  type MappingProposal,
} from '@sarmata/services';
import { decisionsFromForm, mappingFromForm, postedDecisions } from '@/lib/hr/import';
import { createSupabase } from '@/lib/supabase';
import { serviceErrorMessage } from '@/lib/service-errors';

export type ImportState =
  | { step: 'file'; error?: string }
  | { step: 'mapping'; csv: string; proposal: MappingProposal; error?: string }
  | {
      step: 'preview';
      csv: string;
      mapping: ColumnMapping;
      preview: ImportPreview;
      /** Choices of the similar-name rows as posted (`decision.<row>`), kept after a failed commit. */
      decisions?: Record<string, string>;
      error?: string;
    }
  | { step: 'done'; report: ImportReport; error?: string };

const REQUIRED = ['firstName', 'lastName'] as const;

function csvOf(formData: FormData): string {
  const csv = formData.get('csv');
  return typeof csv === 'string' ? csv : '';
}

/** Runs a service call, turning a `ServiceError` into its Polish message. Anything else is rethrown. */
async function attempt<T>(fn: () => Promise<T> | T): Promise<{ value: T } | { error: string }> {
  try {
    return { value: await fn() };
  } catch (error) {
    if (error instanceof ServiceError) {
      return { error: serviceErrorMessage(error.code, error.details) };
    }
    throw error;
  }
}

/** Step 1: proposes which CSV column fills which employee field. */
export async function proposeImportMapping(
  _prev: ImportState,
  formData: FormData,
): Promise<ImportState> {
  const csv = csvOf(formData);
  const services = servicesFor(await createSupabase());
  const result = await attempt(() => services.employeeImport.proposeMapping(csv));
  if ('error' in result) return { step: 'file', error: result.error };
  return { step: 'mapping', csv, proposal: result.value };
}

/** Step 2: the dry run with the chosen mapping. Missing names send hr back to the mapping. */
export async function dryRunImport(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const csv = csvOf(formData);
  const mapping = mappingFromForm(formData);
  const services = servicesFor(await createSupabase());

  const proposed = await attempt(() => services.employeeImport.proposeMapping(csv));
  if ('error' in proposed) return { step: 'file', error: proposed.error };
  const missing = REQUIRED.filter((field) => !mapping[field]);
  if (missing.length > 0) {
    return {
      step: 'mapping',
      csv,
      proposal: { ...proposed.value, mapping, missing: [...missing] },
    };
  }

  const result = await attempt(() => services.employeeImport.dryRun(csv, mapping));
  if ('error' in result) {
    return {
      step: 'mapping',
      csv,
      proposal: { ...proposed.value, mapping, missing: [] },
      error: result.error,
    };
  }
  return { step: 'preview', csv, mapping, preview: result.value };
}

/**
 * Step 3: writes the rows with hr's decisions. A refusal stays on the preview with the message, so
 * the file, the mapping and every decision survive.
 */
export async function commitImport(prev: ImportState, formData: FormData): Promise<ImportState> {
  const csv = csvOf(formData);
  const mapping = mappingFromForm(formData);
  const services = servicesFor(await createSupabase());
  const result = await attempt(() =>
    services.employeeImport.commit(csv, mapping, decisionsFromForm(formData)),
  );
  if ('error' in result) {
    if (prev.step !== 'preview') return { step: 'file', error: result.error };
    return {
      step: 'preview',
      csv,
      mapping,
      preview: prev.preview,
      decisions: postedDecisions(formData),
      error: result.error,
    };
  }
  return { step: 'done', report: result.value };
}
