import type { Metadata } from 'next';
import { DataTable, EmptyState, Section } from '@sarmata/ui';
import { officeEmployees } from '@/lib/account';
import { caseTitle, loadCase } from '../loader';
import { journalRows, type JournalRow } from './journal';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Dziennik') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [{ view }, employees] = await Promise.all([loadCase(id), officeEmployees()]);
  const names = new Map<string, string>();
  for (const employee of employees) {
    if (employee.userId) names.set(employee.userId, `${employee.firstName} ${employee.lastName}`);
  }
  const rows = journalRows(view.events, names);

  return (
    <Section title="Dziennik zdarzeń">
      <div className="flex flex-col gap-5">
        <p className="max-w-[70ch]">
          Każda czynność w ocenie z datą faktyczną. Wpisów nie można usuwać.
        </p>
        <DataTable<JournalRow>
          caption="Dziennik zdarzeń oceny"
          rows={rows}
          rowKey={(row) => row.id}
          empty={
            <EmptyState title="Dziennik jest pusty">
              Wpisy pojawią się po pierwszej czynności w ocenie.
            </EmptyState>
          }
          columns={[
            { key: 'occurredOn', header: 'Data zdarzenia', cell: (row) => row.occurredOn },
            {
              key: 'label',
              header: 'Zdarzenie',
              rowHeader: true,
              cell: (row) => (
                <>
                  {row.label}
                  {row.details.map((detail) => (
                    <span key={detail} className="block text-[0.875rem]">
                      {detail}
                    </span>
                  ))}
                </>
              ),
            },
            { key: 'recordedBy', header: 'Kto wpisał', cell: (row) => row.recordedBy },
            { key: 'recordedAt', header: 'Kiedy wpisano', cell: (row) => row.recordedAt },
          ]}
        />
      </div>
    </Section>
  );
}
