import type { Metadata } from 'next';
import Link from 'next/link';
import { servicesFor } from '@sarmata/services';
import { Notice, Section } from '@sarmata/ui';
import { LinkedErrorSummary } from '@/components/sheet/linked-error-summary';
import { SheetSummary } from '@/components/sheet/sheet-summary';
import { criterionName } from '@/lib/case-regulation';
import { checkMode } from '@/lib/evaluations/sheet-access';
import { gateLinks, gateTitle } from '@/lib/evaluations/sheet-gates';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { caseTitle, loadCase } from '../loader';
import { ApproveForm } from './_check/approve-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Sprawdzenie arkusza') };
}

/** The office default place. The settings may be closed to the evaluator, then there is no default. */
async function defaultPlaceOf(): Promise<string> {
  try {
    const settings = await servicesFor(await createSupabase()).officeSettings.get();
    return settings.defaultPlace ?? '';
  } catch (error) {
    console.warn('sprawdz: office settings not readable', error);
    return '';
  }
}

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zatwierdzono?: string | string[] }>;
}) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await loadCase(id);
  const { view, regulation } = data;
  const issues = gateLinks(id, data.approval.issues, (criterionId) =>
    criterionName(regulation, criterionId),
  );
  const mode = checkMode(view.status, data.canWrite, issues.length);
  const justApproved = query.zatwierdzono === '1' && view.status === 'drafted';

  return (
    <Section title="Sprawdź arkusz przed zatwierdzeniem">
      <div className="flex flex-col gap-6">
        {justApproved ? (
          <Notice tone="success" role="status">
            <p>Arkusz zatwierdzony. Następny krok: zapoznanie osoby ocenianej z oceną.</p>
            <p>
              <Link href={routes.evaluationEvents(id)} className="text-link underline">
                Przejdź do zdarzeń
              </Link>
            </p>
          </Notice>
        ) : null}
        {mode === 'period' ? (
          <Notice tone="info">
            <p>
              Najpierw odnotuj rozmowę oceniającą w{' '}
              <Link href={routes.evaluationPart2(id)} className="text-link underline">
                części II
              </Link>
              .
            </p>
          </Notice>
        ) : null}
        {mode === 'blocked' ? (
          <LinkedErrorSummary title={gateTitle(issues.length)} items={issues} />
        ) : null}
        <SheetSummary data={data} editable={view.status === 'interview' && data.canWrite} />
        {mode === 'approve' ? (
          <ApproveForm id={id} today={data.today} defaultPlace={await defaultPlaceOf()} />
        ) : null}
      </div>
    </Section>
  );
}
