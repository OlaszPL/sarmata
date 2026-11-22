import type { Metadata } from 'next';
import Link from 'next/link';
import { Button, Notice, Section, SummaryList } from '@sarmata/ui';
import { criterionName } from '@/lib/case-regulation';
import { formatDate, pluralPl } from '@/lib/format';
import { approvalIssueItems } from '@/lib/service-errors';
import { caseTitle, loadCase } from './loader';
import { issueTab, stepCard, warningText } from './_overview/overview';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Przegląd sprawy') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadCase((await params).id);
  const { view, regulation, approval } = data;
  const card = stepCard({
    view,
    step: data.nextStep,
    canWrite: data.canWrite,
    isHr: data.isHr,
    today: data.today,
  });
  const tab = issueTab(view);
  const issues = tab
    ? approvalIssueItems(approval.issues, (id) => criterionName(regulation, id))
    : [];
  const hasLawWarning = view.warnings.some((warning) => warning.code === 'grade_due_by_law');
  const gradeByLaw = view.signals.gradeByLaw;

  return (
    <Section title="Przegląd sprawy">
      <div className="flex flex-col gap-6">
        <section className="bg-band border-navy flex flex-col gap-2 border-l-4 px-5 py-4">
          <h3 className="font-heading text-xl leading-[normal] font-semibold">Następny krok</h3>
          {card ? (
            <>
              <p className="font-heading text-ink-muted text-sm leading-[normal] font-semibold">
                {card.stage}
              </p>
              <p className="max-w-[70ch] text-lg leading-[1.4]">{card.action}</p>
              <p>Kto: {card.who}</p>
              {card.due ? <p>Termin: {card.due}</p> : null}
              {card.link ? (
                card.link.primary ? (
                  <Button asChild className="self-start">
                    <Link href={card.link.href}>{card.link.label}</Link>
                  </Button>
                ) : (
                  <Button asChild variant="link" className="self-start">
                    <Link href={card.link.href}>{card.link.label}</Link>
                  </Button>
                )
              ) : null}
            </>
          ) : (
            <p className="max-w-[70ch]">
              {view.status === 'interrupted'
                ? 'Ocena została przerwana.'
                : 'Ocena jest zamknięta. Nic nie zostało do zrobienia.'}
            </p>
          )}
        </section>

        {tab && issues.length > 0 ? (
          <Notice
            tone="warning"
            title={`Przed zatwierdzeniem uzupełnij ${issues.length} ${pluralPl(issues.length, 'pole', 'pola', 'pól')}`}
          >
            <ul className="flex list-none flex-col gap-1">
              {issues.map((item) => (
                <li key={`${item.fieldId}|${item.message}`}>
                  <Link href={`${tab}#${item.fieldId}`} className="text-link underline">
                    {item.message}
                  </Link>
                </li>
              ))}
            </ul>
          </Notice>
        ) : null}

        {view.warnings.map((warning) => (
          <Notice key={warning.code} tone="warning">
            {warningText(warning)}
          </Notice>
        ))}
        {gradeByLaw && !hasLawWarning ? (
          <Notice tone="info">
            Stopień z mocy prawa przysługuje od {formatDate(gradeByLaw.dueOn)} (art. 89 ust. 2
            ustawy). Kadry przyznają go w rejestrze.
          </Notice>
        ) : null}

        <Section title="Dane sprawy" titleLevel={3}>
          <SummaryList
            rows={[
              { key: 'Osoba oceniana', value: data.employeeName },
              { key: 'Stanowisko', value: view.currentPosition.positionTitle },
              { key: 'Komórka', value: view.currentPosition.orgUnit },
              { key: 'Arkusz', value: `Arkusz ${view.sheetId}` },
              {
                key: 'Prowadzi ocenę',
                value: data.evaluatorName ?? 'Konto spoza listy pracowników',
              },
              { key: 'Początek okresu', value: formatDate(view.cycleStart) },
              { key: 'Wersja przepisów', value: regulation.name },
              {
                key: 'Kryteria',
                value: regulation.criteria.map((criterion) => criterion.name).join(', '),
              },
            ]}
          />
        </Section>
      </div>
    </Section>
  );
}
