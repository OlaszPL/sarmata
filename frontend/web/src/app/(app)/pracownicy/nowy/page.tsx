import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, PageHero } from '@sarmata/ui';
import { type NewEmployeeChoices, NewEmployeeForm } from '@/components/employees/new-employee-form';
import { officeEmployees, requireMember } from '@/lib/account';
import {
  employmentBasisLabels,
  positionKindLabels,
  serviceStatusLabels,
} from '@/lib/employees/labels';
import { romanNumeral } from '@/lib/format';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Nowy pracownik' };

const FIXED_TERM_HINT = 'Pracownik na czas określony nie podlega ocenie okresowej.';

function options<K extends string>(
  labels: Record<K, string>,
  hints: Partial<Record<K, string>> = {},
): NewEmployeeChoices['positionKind'] {
  return (Object.entries(labels) as [K, string][]).map(([value, label]) => ({
    value,
    label,
    hint: hints[value],
  }));
}

/** New employee record (`/pracownicy/nowy`). Evaluators and hr add people, admin only reads. */
export default async function NewEmployeePage() {
  const account = await requireMember();
  const listLabel = account.role === 'evaluator' ? 'Moi pracownicy' : 'Pracownicy urzędu';

  let choices: NewEmployeeChoices | null = null;
  if (account.role !== 'admin') {
    const supervisors =
      account.role === 'hr'
        ? (await officeEmployees())
            .filter((employee) => employee.anonymizedAt === null && !employee.employmentEndedOn)
            .map((employee) => ({
              value: employee.id,
              label: [`${employee.firstName} ${employee.lastName}`, employee.positionTitle]
                .filter(Boolean)
                .join(', '),
            }))
        : null;
    choices = {
      positionKind: options(positionKindLabels),
      serviceStatus: options(serviceStatusLabels),
      employmentBasis: options(employmentBasisLabels, { fixed_term: FIXED_TERM_HINT }),
      grades: Array.from({ length: 9 }, (_, index) => ({
        value: String(index + 1),
        label: romanNumeral(index + 1),
      })),
      supervisors,
    };
  }

  return (
    <div className="flex flex-1 flex-col">
      <PageHero
        linkAs={Link}
        crumbs={[{ href: routes.employees, label: listLabel }, { label: 'Nowy pracownik' }]}
        title="Nowy pracownik"
        meta="Wpisz dane z akt osobowych. Pola bez dopisku (opcjonalnie) są wymagane."
      />
      <div className="px-6 py-8 sm:px-10">
        {choices ? (
          <NewEmployeeForm choices={choices} />
        ) : (
          <Notice tone="info">
            <p>Pracowników dodają oceniający i kadry.</p>
            <p className="mt-2">
              <Link
                href={routes.employees}
                className="font-heading text-link font-medium underline"
              >
                Wróć do listy pracowników
              </Link>
            </p>
          </Notice>
        )}
      </div>
    </div>
  );
}
