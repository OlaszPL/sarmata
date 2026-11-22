import type { Metadata } from 'next';
import Link from 'next/link';
import type { Employee } from '@sarmata/services';
import { Button, EmptyState, Notice, Section } from '@sarmata/ui';
import { officeEmployees, requireMember } from '@/lib/account';
import { HrPage } from '@/components/hr/hr-page';
import { hrAccess } from '@/lib/hr/access';
import { type OrgNode, orgTree } from '@/lib/hr/org-tree';
import { routes } from '@/lib/routes';
import { SupervisorForm } from './supervisor-form';

export const metadata: Metadata = { title: 'Struktura przełożonych' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

const fullName = (e: Employee) => `${e.firstName} ${e.lastName}`;

function TreeList({ nodes }: { nodes: readonly OrgNode[] }) {
  return (
    <ul className="grid gap-4">
      {nodes.map(({ employee, reports }) => (
        <li key={employee.id} className="grid gap-4">
          <div className="grid gap-1">
            <p className="font-heading text-ink font-bold break-words">{fullName(employee)}</p>
            {employee.positionTitle ? (
              <p className="break-words">{employee.positionTitle}</p>
            ) : null}
            {employee.orgUnit ? (
              <p className="text-ink-muted break-words">{employee.orgUnit}</p>
            ) : null}
            <Link
              href={`${routes.hrTree}?pracownik=${employee.id}#zmiana`}
              className="text-link w-fit underline"
            >
              Zmień przełożonego<span className="sr-only">: {fullName(employee)}</span>
            </Link>
          </div>
          {reports.length > 0 ? (
            <div className="border-rule border-l pl-4 sm:pl-6">
              <TreeList nodes={reports} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export default async function StructurePage({ searchParams }: { searchParams: SearchParams }) {
  const account = await requireMember();
  if (hrAccess(account.role, 'tree') !== 'write') {
    return <HrPage title="Struktura przełożonych" denied="struktury przełożonych" />;
  }

  const [employees, params] = await Promise.all([officeEmployees(), searchParams]);
  const active = employees.filter((e) => e.employmentEndedOn === null && e.anonymizedAt === null);
  const tree = orgTree(employees);

  const target = active.find((e) => e.id === first(params.pracownik));
  const saved = active.find((e) => e.id === first(params.zmieniono));

  const options = active
    .filter((e) => e.id !== target?.id)
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, 'pl') || a.firstName.localeCompare(b.firstName, 'pl'),
    )
    .map((e) => ({ id: e.id, label: e.orgUnit ? `${fullName(e)}, ${e.orgUnit}` : fullName(e) }));

  return (
    <HrPage
      title="Struktura przełożonych"
      meta="Kto komu podlega. Od tego zależy, kto prowadzi ocenę."
    >
      <div className="grid gap-8">
        {saved ? (
          <Notice tone="success" role="status">
            Zapisano przełożonego: {fullName(saved)}.
          </Notice>
        ) : null}
        {target ? (
          <Section id="zmiana" title={`Zmień przełożonego: ${fullName(target)}`}>
            <SupervisorForm
              key={target.id}
              employeeId={target.id}
              currentSupervisorId={target.supervisorEmployeeId}
              options={options}
            />
          </Section>
        ) : null}
        {tree.length === 0 ? (
          <EmptyState
            title="Nie ma pracowników"
            action={
              <Button asChild variant="primary">
                <Link href={routes.hrImport}>Zaimportuj pracowników</Link>
              </Button>
            }
          >
            Zaimportuj listę pracowników, a zobaczysz tu ich strukturę.
          </EmptyState>
        ) : (
          <TreeList nodes={tree} />
        )}
      </div>
    </HrPage>
  );
}
