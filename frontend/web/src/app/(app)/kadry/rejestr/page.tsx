import type { Metadata } from 'next';
import { servicesFor } from '@sarmata/services';
import { DataTable, Section, Tag } from '@sarmata/ui';
import { requireMember } from '@/lib/account';
import { HrPage } from '@/components/hr/hr-page';
import { formatDate } from '@/lib/format';
import { hrAccess } from '@/lib/hr/access';
import { appealCases } from '@/lib/hr/register';
import { loadViews } from '@/lib/hr/views';
import { createSupabase } from '@/lib/supabase';
import { AppealForm } from './appeal-form';
import { GradeGrantForm } from './grade-grant-form';

export const metadata: Metadata = { title: 'Rejestr kadr' };

const BASIS_LABELS = { on_request: 'Na wniosek z oceny', by_law: 'Z mocy prawa' } as const;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function RegisterPage({ searchParams }: { searchParams: SearchParams }) {
  const account = await requireMember();
  if (hrAccess(account.role, 'register') !== 'write') {
    return <HrPage title="Rejestr kadr" denied="rejestr kadr" />;
  }

  const services = servicesFor(await createSupabase());
  const [params, views, employees, evaluations] = await Promise.all([
    searchParams,
    loadViews((e) => e.status === 'closed'),
    services.employees.list(),
    services.evaluations.list(),
  ]);

  const cases = appealCases(views);
  const openCases = cases.filter((c) => c.appealedOn === null);

  const servants = employees
    .filter((e) => e.serviceStatus === 'civil_servant')
    .sort(
      (a, b) =>
        a.lastName.localeCompare(b.lastName, 'pl') || a.firstName.localeCompare(b.firstName, 'pl'),
    );
  const servantIds = new Set(servants.map((e) => e.id));
  const servantEvaluations = evaluations.filter(
    (e) => e.snapshot.serviceStatus === 'civil_servant' && servantIds.has(e.employeeId),
  );
  const names = new Map(servants.map((e) => [e.id, `${e.firstName} ${e.lastName}`]));

  const grantsByEmployee = await Promise.all(
    servants.map((e) => services.hrRegister.gradeGrants(e.id)),
  );
  const grants = grantsByEmployee
    .flat()
    .sort(
      (a, b) => b.grantedOn.localeCompare(a.grantedOn) || b.recordedAt.localeCompare(a.recordedAt),
    );

  const requested = typeof params.ocena === 'string' ? params.ocena : null;
  const preselected = servantEvaluations.find((e) => e.id === requested);

  return (
    <HrPage
      title="Rejestr kadr"
      meta="Odwołania do sądu pracy po nieuwzględnionym sprzeciwie i stopnie służbowe urzędników."
    >
      <div className="grid gap-8">
        <Section title="Odwołania do sądu pracy" id="odwolania">
          <DataTable
            caption="Sprawy z nieuwzględnionym sprzeciwem"
            rows={cases}
            rowKey={(c) => c.evaluationId}
            empty={<p className="py-5">Nie ma jeszcze spraw z nieuwzględnionym sprzeciwem.</p>}
            columns={[
              {
                key: 'employee',
                header: 'Pracownik',
                rowHeader: true,
                cell: (c) => c.employeeName,
              },
              {
                key: 'outcome',
                header: 'Sprzeciw nieuwzględniony',
                className: 'whitespace-nowrap',
                cell: (c) => formatDate(c.outcomeOn),
              },
              {
                key: 'appeal',
                header: 'Odwołanie',
                className: 'whitespace-nowrap',
                cell: (c) =>
                  c.appealedOn === null ? (
                    <Tag tone="attention">Brak wpisu</Tag>
                  ) : (
                    formatDate(c.appealedOn)
                  ),
              },
            ]}
          />
          <div className="mt-6 grid gap-8">
            {openCases.length === 0 ? (
              <p className="max-w-[70ch]">
                Nie ma spraw z nieuwzględnionym sprzeciwem bez zapisanego odwołania.
              </p>
            ) : (
              openCases.map((c) => (
                <AppealForm
                  key={c.evaluationId}
                  evaluationId={c.evaluationId}
                  employeeName={c.employeeName}
                />
              ))
            )}
          </div>
        </Section>

        <Section title="Stopnie służbowe" id="stopien">
          <div className="grid gap-8">
            <GradeGrantForm
              employees={servants.map((e) => ({
                value: e.id,
                label: `${e.firstName} ${e.lastName}, obecny stopień ${e.grade ?? 'brak'}`,
              }))}
              evaluations={servantEvaluations.map((e) => ({
                value: e.id,
                label: `${e.snapshot.firstName} ${e.snapshot.lastName}, ocena od ${formatDate(e.cycleStart)}`,
              }))}
              defaults={{
                employeeId: preselected?.employeeId ?? '',
                basis: preselected ? 'by_law' : '',
                evaluationId: preselected?.id ?? '',
              }}
            />
            <DataTable
              caption="Przyznane stopnie"
              rows={grants}
              rowKey={(g) => g.id}
              empty={<p className="py-5">Nie ma jeszcze przyznanych stopni.</p>}
              columns={[
                {
                  key: 'employee',
                  header: 'Pracownik',
                  rowHeader: true,
                  cell: (g) => names.get(g.employeeId) ?? 'Brak danych',
                },
                { key: 'basis', header: 'Podstawa', cell: (g) => BASIS_LABELS[g.basis] },
                {
                  key: 'date',
                  header: 'Data',
                  className: 'whitespace-nowrap',
                  cell: (g) => formatDate(g.grantedOn),
                },
                { key: 'from', header: 'Z', cell: (g) => g.previousGrade ?? 'Brak' },
                { key: 'to', header: 'Na', cell: (g) => g.newGrade },
              ]}
            />
          </div>
        </Section>
      </div>
    </HrPage>
  );
}
