import 'server-only';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import {
  type CalendarDate,
  type EvaluationView,
  type MemberAccount,
  servicesFor,
} from '@sarmata/services';
import { z } from 'zod';
import { officeEmployees, requireMember } from '@/lib/account';
import { type NextStep, nextStep } from '@/lib/evaluations/next-step';
import { todayInWarsaw } from '@/lib/format';
import { type CaseRegulation, regulationForEvaluation } from '@/lib/regulation';
import { createSupabase } from '@/lib/supabase';

/** Everything the case layout and its tabs need, read once per request. */
export interface CaseData {
  view: EvaluationView;
  regulation: CaseRegulation;
  account: MemberAccount;
  /**
   * The signed-in account leads this evaluation (`view.evaluatorAccountId`) and is not an admin, so
   * the evaluator forms show. The status of the case still decides which ones; the backend enforces.
   */
  canWrite: boolean;
  isHr: boolean;
  isAdmin: boolean;
  nextStep: NextStep | null;
  /** First and last name of the evaluated person. */
  employeeName: string;
  /** Name of the account that leads the evaluation, null when it is not in the office list. */
  evaluatorName: string | null;
  today: CalendarDate;
}

const idSchema = z.uuid();

async function evaluatorNameOf(accountId: string): Promise<string | null> {
  try {
    const person = (await officeEmployees()).find((employee) => employee.userId === accountId);
    return person ? `${person.firstName} ${person.lastName}` : null;
  } catch {
    return null;
  }
}

/**
 * Loads an evaluation case for the signed-in member. React `cache` makes the layout and the page of
 * one request share a single read. Unknown ids and cases outside the office (RLS) give 404.
 */
export const loadCase = cache(async (id: string): Promise<CaseData> => {
  if (!idSchema.safeParse(id).success) notFound();
  const account = await requireMember();
  const view = await servicesFor(await createSupabase()).evaluations.get(id);
  if (view === null) notFound();
  const [regulation, evaluatorName] = await Promise.all([
    regulationForEvaluation(view),
    evaluatorNameOf(view.evaluatorAccountId),
  ]);
  const isAdmin = account.role === 'admin';
  return {
    view,
    regulation,
    account,
    canWrite: !isAdmin && view.evaluatorAccountId === account.userId,
    isHr: account.role === 'hr',
    isAdmin,
    nextStep: nextStep(view),
    employeeName: `${view.snapshot.firstName} ${view.snapshot.lastName}`,
    evaluatorName,
    today: todayInWarsaw(),
  };
});

/** Page title of a case tab, e.g. "Część I, Ewa Ewidencyjna". */
export async function caseTitle(id: string, section: string): Promise<string> {
  const { employeeName } = await loadCase(id);
  return `${section}, ${employeeName}`;
}
