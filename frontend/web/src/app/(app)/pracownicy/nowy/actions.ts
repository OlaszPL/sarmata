'use server';

import { redirect } from 'next/navigation';
import { z } from 'zod';
import { servicesFor } from '@sarmata/services';
import { requireMember } from '@/lib/account';
import { type FormState, formValues, parseForm, runService } from '@/lib/form-action';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';

export type NewEmployeeState = FormState & {
  /** People already in the records whose name resembles the typed one, shown before a new record is made. */
  similar?: { id: string; name: string; position: string | null }[];
};

const CIVIL_SERVANT_ONLY =
  'Stopień i rok mianowania podaje się tylko dla urzędnika służby cywilnej';

/** An empty optional text becomes `null`. */
const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value));

/** An empty optional date becomes `null`, a filled one must be `rrrr-mm-dd` as the date picker sends it. */
const optionalDate = (message: string) =>
  optionalText.pipe(
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, message)
      .nullable(),
  );

const newEmployeeFormSchema = z
  .object({
    firstName: z.string().trim().min(1, 'Wpisz imię'),
    lastName: z.string().trim().min(1, 'Wpisz nazwisko'),
    email: optionalText.pipe(z.email('Wpisz poprawny adres e-mail').nullable()),
    positionTitle: optionalText,
    orgUnit: optionalText,
    positionKind: z.enum(['office_head', 'manages_people', 'other'], {
      error: 'Wybierz rodzaj stanowiska',
    }),
    serviceStatus: z.enum(['civil_servant', 'employee'], {
      error: 'Wybierz status w służbie cywilnej',
    }),
    employmentBasis: z.enum(['indefinite', 'appointment', 'fixed_term'], {
      error: 'Wybierz podstawę zatrudnienia',
    }),
    employmentStart: optionalDate('Wpisz poprawną datę rozpoczęcia pracy'),
    appointmentYear: optionalText.pipe(
      z
        .string()
        .regex(/^\d{4}$/, 'Wpisz rok mianowania czterema cyframi')
        .transform(Number)
        .pipe(
          z
            .number()
            .int()
            .min(1990, 'Wpisz rok mianowania od 1990 do 2100')
            .max(2100, 'Wpisz rok mianowania od 1990 do 2100'),
        )
        .nullable(),
    ),
    grade: optionalText.pipe(
      z
        .enum(['1', '2', '3', '4', '5', '6', '7', '8', '9'], { error: 'Wybierz stopień z listy' })
        .transform(Number)
        .nullable(),
    ),
    gradeGrantedOn: optionalDate('Wpisz poprawną datę nadania stopnia'),
    supervisorEmployeeId: optionalText.pipe(z.uuid('Wybierz przełożonego z listy').nullable()),
    confirmDistinct: z.string(),
  })
  .superRefine((value, context) => {
    // Runs next to the field errors (zod 4 refines a partly invalid object), so check what is set.
    if (value.serviceStatus !== 'employee') return;
    for (const key of ['appointmentYear', 'grade', 'gradeGrantedOn'] as const) {
      if (value[key] != null) {
        context.addIssue({ code: 'custom', path: [key], message: CIVIL_SERVANT_ONLY });
      }
    }
  });

/**
 * Adds an employee. Before the first save it looks for people with a similar name, the form then
 * asks to confirm that this is another person. On success it opens the new employee card.
 */
export async function createEmployee(
  previous: NewEmployeeState,
  formData: FormData,
): Promise<NewEmployeeState> {
  const account = await requireMember();
  const values = formValues(formData);
  if (account.role === 'admin') {
    return { values, fieldErrors: {}, formError: 'Pracowników dodają oceniający i kadry.' };
  }

  const parsed = parseForm(newEmployeeFormSchema, formData);
  if ('state' in parsed) return parsed.state;
  const { confirmDistinct, supervisorEmployeeId, ...profile } = parsed.data;
  const services = servicesFor(await createSupabase());

  if (confirmDistinct !== '1') {
    const found = await runService(
      () => services.employees.findSimilar(`${profile.firstName} ${profile.lastName}`),
      undefined,
      values,
    );
    if (!found.ok) return found.state;
    if (found.value.length > 0) {
      return {
        values,
        fieldErrors:
          previous.similar && previous.similar.length > 0
            ? {
                confirmDistinct:
                  'Zaznacz, że to inna osoba, albo otwórz kartę osoby, która już jest w aktach',
              }
            : {},
        similar: found.value.map((person) => ({
          id: person.id,
          name: `${person.firstName} ${person.lastName}`,
          position: [person.positionTitle, person.orgUnit].filter(Boolean).join(', ') || null,
        })),
      };
    }
  }

  const created = await runService(
    () =>
      services.employees.create({
        ...profile,
        // Only hr sets the supervisor, the database refuses it for other roles.
        supervisorEmployeeId: account.role === 'hr' ? supervisorEmployeeId : null,
      }),
    undefined,
    values,
  );
  if (!created.ok) return created.state;

  redirect(`${routes.employee(created.value.id)}?dodano=1`);
}
