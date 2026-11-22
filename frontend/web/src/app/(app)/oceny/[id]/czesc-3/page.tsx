import type { Metadata } from 'next';
import Link from 'next/link';
import { Notice, Section } from '@sarmata/ui';
import { SheetSummary } from '@/components/sheet/sheet-summary';
import { gradeRequestMode } from '@/lib/evaluations/sheet-access';
import { formatDate, romanNumeral } from '@/lib/format';
import { routes } from '@/lib/routes';
import { caseTitle, loadCase } from '../loader';
import { GradeRequestForm } from './_grade/grade-request-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Część III') };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadCase(id);
  const { view } = data;
  const mode = gradeRequestMode(view, data.canWrite);
  const dueByLaw = view.warnings.find((warning) => warning.code === 'grade_due_by_law');
  const request = view.sheet.content.partTwo.gradeRequest;

  return (
    <Section title="Część III. Wniosek o stopień">
      <div className="flex flex-col gap-6">
        <p className="max-w-[70ch]">
          Wniosek o przyznanie wyższego stopnia składasz tylko dla urzędnika służby cywilnej z oceną
          pozytywną (art. 81 ust. 3 ustawy).
        </p>
        {dueByLaw ? (
          <Notice tone="warning">
            <p>
              Stopień przysługuje z mocy prawa od {formatDate(dueByLaw.dueOn)} (art. 89 ust. 2
              ustawy), więc wniosek nie jest potrzebny.
            </p>
          </Notice>
        ) : null}
        {mode === 'not_civil_servant' ? (
          <Notice tone="info">
            <p>
              Osoba oceniana nie jest urzędnikiem służby cywilnej, więc ta część nie dotyczy tej
              oceny.
            </p>
          </Notice>
        ) : null}
        {mode === 'max_grade' ? (
          <Notice tone="info">
            <p>Osoba oceniana ma najwyższy stopień IX. Wniosku nie można złożyć.</p>
          </Notice>
        ) : null}
        {mode === 'negative' ? (
          <Notice tone="info">
            <p>Przy ocenie negatywnej nie składasz wniosku.</p>
          </Notice>
        ) : null}
        {mode === 'incomplete' ? (
          <Notice tone="info">
            <p>
              Wniosek będzie możliwy po ocenie wszystkich kryteriów w{' '}
              <Link href={routes.evaluationPart2(id)} className="text-link underline">
                części II
              </Link>
              .
            </p>
          </Notice>
        ) : null}
        {mode === 'form' && view.snapshot.grade !== null ? (
          <GradeRequestForm
            id={id}
            requestedGradeLabel={romanNumeral(view.snapshot.grade + 1)}
            saved={{
              request: request === null ? null : 'yes',
              motivation: request?.motivation ?? '',
            }}
          />
        ) : (
          <SheetSummary data={data} editable={false} parts={['three']} />
        )}
      </div>
    </Section>
  );
}
