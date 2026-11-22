import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  type AiRun,
  type AiRunKind,
  type CalendarDate,
  type Employee,
  type MemberAccount,
  type Note,
  type RegulationDocument,
  servicesFor,
} from '@sarmata/services';
import { z } from 'zod';
import { officeEmployees, requireMember } from '@/lib/account';
import { nextStep } from '@/lib/evaluations/next-step';
import { todayInWarsaw } from '@/lib/format';
import { createSupabase } from '@/lib/supabase';
import { type EmployeeHistory, type HistoryRegulation, employeeHistory } from './history';
import {
  type AiPanelState,
  type AppreciationModel,
  appreciationModel,
  hrPartnerModel,
} from './hr-partner';

/** Everything the employee card and its side panel need, read once per request. */
export interface CardData {
  employee: Employee;
  account: MemberAccount;
  today: CalendarDate;
  history: EmployeeHistory;
  /** The newest evaluation that is neither closed nor interrupted. */
  currentEvaluationId: string | null;
  /** Null when the account may not read the notes of this person (admin) or they did not load. */
  notes: Note[] | null;
  /** Criteria catalog of the regulation in force, for the note form. */
  criteria: { id: string; name: string }[];
  criteriaNames: Map<string, string>;
  /** Partial scale of the regulation in force, for the archived evaluation form. */
  scale: { points: number; name: string }[];
  levels: { code: string; name: string }[];
  /** Mandatory criteria of the sheet for the position kind of the employee. */
  sheetMandatory: string[];
  ai: { enabled: boolean; signals: AiPanelState; appreciation: AppreciationModel | null };
  settings: { visibility: 'office' | 'tree'; retentionMonths: number };
  supervisorName: string | null;
}

const idSchema = z.uuid();

/** Stand-in when the regulation in force did not load: no level or criterion names. */
const NO_REGULATION: HistoryRegulation = {
  criteria: { catalog: [] },
  partialScale: { levels: [] },
};

/** Defaults of the office settings table, used when the settings did not load. */
const DEFAULT_SETTINGS = { aiEnabled: false, visibility: 'office', retentionMonths: 36 } as const;

const FINISHED = new Set(['closed', 'interrupted']);

/** Resolves to null instead of throwing, for sources the card can live without. */
async function orNull<T>(label: string, read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.warn(`employee card: ${label} failed to load`, error);
    return null;
  }
}

/**
 * Loads the employee card for the signed-in member. React `cache` lets the page and its metadata
 * share one read. An invalid id or an employee outside the office (RLS) gives 404. Every other
 * source degrades to an empty state.
 */
export const loadCard = cache(async (id: string): Promise<CardData> => {
  if (!idSchema.safeParse(id).success) notFound();
  const account = await requireMember();
  const services = servicesFor(await createSupabase());
  const employee = await services.employees.get(id);
  if (employee === null) notFound();
  const today = todayInWarsaw();

  const aiRuns = (kind: AiRunKind): Promise<AiRun[] | null> =>
    orNull(`ai runs ${kind}`, () => services.ai.list({ employeeId: id, kind }));

  const [archived, summaries, regulation, notes, settings, colleagues] = await Promise.all([
    orNull('archived evaluations', () => services.archivedEvaluations.listForEmployee(id)),
    orNull('evaluations', () => services.evaluations.list({ employeeId: id })),
    orNull('regulation', () => services.regulations.inForceOn(today)),
    orNull('notes', () => services.notes.listForEmployee(id)),
    orNull('office settings', () => services.officeSettings.get()),
    orNull('office employees', () => officeEmployees()),
  ]);

  const aiEnabled = settings?.aiEnabled ?? DEFAULT_SETTINGS.aiEnabled;
  const [settled, hrRuns, appreciationRuns] = await Promise.all([
    Promise.allSettled(
      (summaries ?? [])
        .filter((evaluation) => evaluation.status !== 'interrupted')
        .map((evaluation) => services.evaluations.get(evaluation.id)),
    ),
    aiEnabled ? aiRuns('hr_signals') : null,
    aiEnabled ? aiRuns('appreciation_moments') : null,
  ]);

  // One broken case (unknown regulation, bad event payload) must not blank the card.
  const views = settled.flatMap((result) =>
    result.status === 'fulfilled' && result.value !== null ? [result.value] : [],
  );
  const current = [...views]
    .filter((view) => !FINISHED.has(view.status))
    .sort((a, b) => b.cycleStart.localeCompare(a.cycleStart))[0];
  const step = current ? nextStep(current) : null;

  return {
    employee,
    account,
    today,
    history: employeeHistory({
      archived: archived ?? [],
      views,
      document: regulation ?? NO_REGULATION,
      current: step ? { dueOn: step.dueOn, stage: step.stage } : null,
    }),
    currentEvaluationId: current?.id ?? null,
    notes,
    ...regulationParts(regulation, employee),
    ai: {
      enabled: aiEnabled,
      signals: hrPartnerModel(hrRuns, aiEnabled, notes ?? []),
      appreciation: appreciationModel(appreciationRuns),
    },
    settings: {
      visibility: settings?.evaluationVisibility ?? DEFAULT_SETTINGS.visibility,
      retentionMonths: settings?.notesRetentionMonths ?? DEFAULT_SETTINGS.retentionMonths,
    },
    supervisorName: supervisorNameOf(employee, colleagues),
  };
});

function regulationParts(
  regulation: RegulationDocument | null,
  employee: Employee,
): Pick<CardData, 'criteria' | 'criteriaNames' | 'scale' | 'levels' | 'sheetMandatory'> {
  const catalog = regulation?.criteria.catalog ?? [];
  const levels = regulation?.partialScale.levels ?? [];
  // Sheets name the position kind in kebab case (`office-head`), employees in snake case.
  const sheetKind = employee.positionKind.replaceAll('_', '-');
  return {
    criteria: catalog.map((criterion) => ({ id: criterion.id, name: criterion.name })),
    criteriaNames: new Map(catalog.map((criterion) => [criterion.id, criterion.name])),
    scale: levels.map((level) => ({ points: level.points, name: level.name })),
    levels: levels.map((level) => ({ code: level.code, name: level.name })),
    sheetMandatory: [
      ...(regulation?.sheets.find((sheet) => sheet.positionKind === sheetKind)?.mandatoryCriteria ??
        []),
    ],
  };
}

function supervisorNameOf(
  employee: Employee,
  colleagues: readonly Employee[] | null,
): string | null {
  if (employee.supervisorEmployeeId === null) return null;
  const supervisor = colleagues?.find((person) => person.id === employee.supervisorEmployeeId);
  return supervisor ? `${supervisor.firstName} ${supervisor.lastName}` : null;
}
