import Link from 'next/link';
import { type HeroStat, PageHero } from '@sarmata/ui';
import { levelName } from '@/lib/regulation';
import { currentStageIndex } from '@/lib/evaluations/stages';
import { daysUntil, formatDate, formatScore, relativeDays, romanNumeral } from '@/lib/format';
import { routes } from '@/lib/routes';
import { type CaseData } from '../loader';

const serviceStatusLabels = {
  civil_servant: 'Urzędnik służby cywilnej',
  employee: 'Pracownik służby cywilnej',
} as const;

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "Ocena 2024 do 2026" from the cycle start and the evaluation deadline. */
function cycleLabel({ view }: CaseData): string {
  const from = view.cycleStart.slice(0, 4);
  const due = view.deadlines.find((deadline) => deadline.slot === 'evaluationDeadline')?.dueOn;
  const to = due?.slice(0, 4);
  if (!to || to === from) return `Ocena ${from}`;
  return `Ocena ${from} do ${to}`;
}

function metaLine({ view, evaluatorName }: CaseData): string {
  const { positionTitle, orgUnit } = view.currentPosition;
  const { serviceStatus, grade } = view.snapshot;
  const place = [positionTitle, orgUnit].filter(Boolean).join(', ');
  const status =
    serviceStatus === 'civil_servant' && grade !== null
      ? `${serviceStatusLabels[serviceStatus]}, stopień ${romanNumeral(grade)}`
      : serviceStatusLabels[serviceStatus];
  const lead = evaluatorName ? `Prowadzi ocenę: ${evaluatorName}.` : '';
  return [place ? `${place}.` : '', `${status}.`, lead].filter(Boolean).join(' ');
}

function scoreStat({ view, regulation }: CaseData): HeroStat {
  const { mean, levelCode, outcome } = view.score;
  if (mean === null) {
    return { label: 'Wynik na żywo', value: 'Brak', hint: 'Po ocenie wszystkich kryteriów' };
  }
  const level = levelName(regulation, levelCode);
  const hint = level
    ? capitalize(level)
    : outcome === 'negative'
      ? 'Ocena negatywna'
      : 'Ocena pozytywna';
  return { label: 'Wynik na żywo', value: formatScore(mean), hint };
}

function dueStat({ nextStep, today }: CaseData): HeroStat {
  const dueOn = nextStep?.dueOn ?? null;
  if (dueOn === null) return { label: 'Termin', value: 'Brak', hint: 'Bez terminu na tym etapie' };
  // The cell fits `dd.mm` only, a date in another year carries the year in the hint.
  const relative = relativeDays(daysUntil(today, dueOn));
  const year = dueOn.slice(0, 4);
  return {
    label: 'Termin',
    value: formatDate(dueOn).slice(0, 5),
    hint: year === today.slice(0, 4) ? relative : `${year} r., ${relative}`,
  };
}

function stageStat({ view, nextStep }: CaseData, stageCount: number): HeroStat {
  const index = currentStageIndex(view);
  if (view.status === 'closed')
    return { label: 'Etap', value: `${stageCount} z ${stageCount}`, hint: 'Ocena zamknięta' };
  if (view.status === 'interrupted')
    return { label: 'Etap', value: 'Koniec', hint: 'Ocena przerwana' };
  return {
    label: 'Etap',
    value: `${index + 1} z ${stageCount}`,
    hint: nextStep ? `${nextStep.stage} w trakcie` : 'W trakcie',
  };
}

/** Navy case header from the mockup: crumbs, name, position, tags and the three key numbers. */
export function CaseHero({ data, stageCount }: { data: CaseData; stageCount: number }) {
  return (
    <PageHero
      linkAs={Link}
      crumbs={[{ href: routes.evaluations, label: 'Oceny' }, { label: cycleLabel(data) }]}
      title={data.employeeName}
      meta={metaLine(data)}
      tags={[
        `Arkusz ${data.view.sheetId}`,
        `Wersja przepisów ${data.regulation.effectiveFrom.slice(0, 4)}`,
      ]}
      stats={[scoreStat(data), dueStat(data), stageStat(data, stageCount)]}
    />
  );
}
