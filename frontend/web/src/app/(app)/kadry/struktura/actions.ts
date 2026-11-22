'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ServiceError, servicesFor } from '@sarmata/services';
import { z } from 'zod';
import { officeEmployees } from '@/lib/account';
import { type FormState, formValues, parseForm } from '@/lib/form-action';
import { wouldCreateCycle } from '@/lib/hr/org-tree';
import { routes } from '@/lib/routes';
import { serviceErrorMessage } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';

const schema = z.object({ employeeId: z.string().min(1), supervisorId: z.string() });

const SAVE_FAILED = 'Nie udało się zmienić przełożonego. Odśwież stronę i spróbuj ponownie.';

/** Sets or clears the supervisor of an employee. Refuses a choice that would put the employee under themselves. */
export async function changeSupervisor(_prev: FormState, formData: FormData): Promise<FormState> {
  const values = formValues(formData);
  const parsed = parseForm(schema, formData);
  if ('state' in parsed) return parsed.state;
  const { employeeId, supervisorId } = parsed.data;
  const supervisorEmployeeId = supervisorId === '' ? null : supervisorId;

  if (supervisorEmployeeId === employeeId) {
    return { values, fieldErrors: { supervisorId: 'Pracownik nie może być swoim przełożonym.' } };
  }
  const employees = await officeEmployees();
  if (wouldCreateCycle(employees, employeeId, supervisorEmployeeId)) {
    return {
      values,
      fieldErrors: {
        supervisorId: 'Ta osoba podlega już temu pracownikowi. Wybierz kogoś spoza jego zespołu.',
      },
    };
  }

  try {
    const services = servicesFor(await createSupabase());
    await services.employees.update(employeeId, { supervisorEmployeeId });
  } catch (error) {
    if (error instanceof ServiceError) {
      return { values, fieldErrors: {}, formError: serviceErrorMessage(error.code, error.details) };
    }
    if (error instanceof z.ZodError) {
      return {
        values,
        fieldErrors: { supervisorId: error.issues[0]?.message ?? SAVE_FAILED },
      };
    }
    // The backend raises an unexported RepositoryError for rejected updates.
    return { values, fieldErrors: {}, formError: SAVE_FAILED };
  }

  revalidatePath(routes.hrTree);
  redirect(`${routes.hrTree}?zmieniono=${employeeId}`);
}
