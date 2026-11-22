import type { ReactNode } from 'react';
import { StageStrip } from '@sarmata/ui';
import { pluralPl } from '@/lib/format';
import { caseStages } from '@/lib/evaluations/stages';
import { routes } from '@/lib/routes';
import { CaseHero } from './_case/case-hero';
import { CaseSide } from './_case/case-side';
import { type CaseTab, CaseTabs } from './_case/case-tabs';
import { type CaseData, loadCase } from './loader';

const PART_ONE_OPEN = new Set(['criteria', 'criteria_awaiting_signature']);
const SHEET_DONE = new Set(['drafted', 'delivered', 'objection', 'closed']);

function caseTabs({ view }: CaseData): CaseTab[] {
  const entries = view.events.length;
  return [
    { segment: null, href: routes.evaluation(view.id), label: 'Przegląd sprawy' },
    {
      segment: 'czesc-1',
      href: routes.evaluationPart1(view.id),
      label: 'Część I',
      hint: 'Kryteria i termin',
      done: !PART_ONE_OPEN.has(view.status) && view.status !== 'interrupted',
    },
    {
      segment: 'czesc-2',
      alsoFor: ['sprawdz'],
      href: routes.evaluationPart2(view.id),
      label: 'Część II',
      hint: 'Ocena',
      done: SHEET_DONE.has(view.status),
    },
    {
      segment: 'czesc-3',
      href: routes.evaluationPart3(view.id),
      label: 'Część III',
      hint: 'Wniosek o stopień',
    },
    {
      segment: 'zdarzenia',
      href: routes.evaluationEvents(view.id),
      label: 'Zdarzenia',
      hint: 'Zapoznanie, sprzeciw, zmiany',
    },
    {
      segment: 'dziennik',
      href: routes.evaluationJournal(view.id),
      label: 'Dziennik',
      hint: `${entries} ${pluralPl(entries, 'wpis', 'wpisy', 'wpisów')}`,
    },
  ];
}

/**
 * Frame of an evaluation case (mockup 2026-11-22-sprawa-pencil.html): hero, stage strip, side tabs,
 * the tab content and the side band. Tabs render their content with an H2, the H1 is the name.
 */
export default async function CaseLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const data = await loadCase((await params).id);
  const stages = caseStages(data.view);

  return (
    <div className="flex flex-1 flex-col">
      <CaseHero data={data} stageCount={stages.length} />
      <StageStrip stages={stages} className="border-rule border-b" />
      <div className="flex flex-1 flex-col lg:flex-row">
        <CaseTabs
          tabs={caseTabs(data)}
          className="border-rule border-b lg:w-[13.0625rem] lg:shrink-0 lg:border-r lg:border-b-0"
        />
        <div className="min-w-0 flex-1">{children}</div>
        <CaseSide data={data} />
      </div>
    </div>
  );
}
