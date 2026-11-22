import Link from 'next/link';
import { Button, Field, Select } from '@sarmata/ui';
import { aiKindLabels, aiKinds } from '@/lib/ai-log/ai-log';
import { routes } from '@/lib/routes';

export interface EmployeeOption {
  id: string;
  name: string;
}

/** GET filters of the AI log: employee and kind of the run. */
export function AiLogFilters({
  employees,
  employeeId,
  kind,
}: {
  employees: readonly EmployeeOption[];
  employeeId: string | undefined;
  kind: string | undefined;
}) {
  const active = employeeId !== undefined || kind !== undefined;
  return (
    // The key remounts the selects when "Wyczyść filtry" changes the filters by a link.
    <form
      key={`${employeeId ?? ''}|${kind ?? ''}`}
      method="get"
      action={routes.aiLog}
      aria-label="Filtry dziennika"
      className="flex flex-wrap items-end gap-3"
    >
      <Field id="pracownik" label="Pracownik" className="min-w-[14rem] sm:max-w-[22rem]">
        <Select name="pracownik" defaultValue={employeeId ?? ''}>
          <option value="">Wszyscy</option>
          {employees.map((employee) => (
            <option key={employee.id} value={employee.id}>
              {employee.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field id="rodzaj" label="Rodzaj" className="min-w-[14rem] sm:max-w-[22rem]">
        <Select name="rodzaj" defaultValue={kind ?? ''}>
          <option value="">Wszystkie</option>
          {aiKinds.map((value) => (
            <option key={value} value={value}>
              {aiKindLabels[value]}
            </option>
          ))}
        </Select>
      </Field>
      <Button type="submit" variant="secondary" className="h-12">
        Pokaż
      </Button>
      {active ? (
        <Link
          href={routes.aiLog}
          className="font-heading text-link flex min-h-12 items-center font-medium underline"
        >
          Wyczyść filtry
        </Link>
      ) : null}
    </form>
  );
}
