import type { Metadata } from 'next';
import { servicesFor } from '@sarmata/services';
import { Notice } from '@sarmata/ui';
import { officeEmployees } from '@/lib/account';
import { createSupabase } from '@/lib/supabase';
import { caseTitle, loadCase } from '../loader';
import { InterruptionSection, StageSection } from './_sections/stage-section';
import { CorrectionSection, SideSection } from './_sections/side-section';
import {
  eventPanels,
  savedKeyOf,
  savedMessages,
  sideEventRows,
  termChangeReasonLabels,
} from './panels';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Zdarzenia') };
}

const OUTSIDE_LIST = 'Osoba spoza listy pracowników';

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ zapisano?: string | string[] }>;
}) {
  const { id } = await params;
  const { zapisano } = await searchParams;
  const data = await loadCase(id);
  const { view, canWrite, isHr, isAdmin } = data;
  const services = servicesFor(await createSupabase());
  const [settings, document, employees] = await Promise.all([
    services.officeSettings.get(),
    services.regulations.forEvaluation(view.id),
    officeEmployees(),
  ]);
  const saved = savedKeyOf(zapisano);
  const panels = eventPanels({
    status: view.status,
    sheetState: view.sheet.state,
    canWrite,
    isHr,
    isAdmin,
  });
  const accounts = employees.filter((employee) => employee.userId !== null);
  const nameOf = (accountId: string) => {
    const person = accounts.find((employee) => employee.userId === accountId);
    return person ? `${person.firstName} ${person.lastName}` : OUTSIDE_LIST;
  };
  const rows = sideEventRows(view, {
    reason: (reason) =>
      Object.hasOwn(termChangeReasonLabels, reason)
        ? termChangeReasonLabels[reason as keyof typeof termChangeReasonLabels]
        : reason,
    account: nameOf,
  });
  const people = accounts.flatMap((employee) =>
    employee.userId === null || employee.userId === view.evaluatorAccountId
      ? []
      : [{ accountId: employee.userId, name: `${employee.firstName} ${employee.lastName}` }],
  );

  return (
    <div className="flex flex-col gap-12">
      {saved ? (
        <Notice tone="success" role="status">
          {savedMessages[saved]}
        </Notice>
      ) : null}
      <StageSection data={data} panels={panels} defaultPlace={settings.defaultPlace} />
      <SideSection
        data={data}
        panels={panels}
        rows={rows}
        termChange={document.termChange}
        people={people}
      />
      {panels.has('correction') ? <CorrectionSection data={data} /> : null}
      {panels.has('interruption') ? <InterruptionSection data={data} /> : null}
    </div>
  );
}
