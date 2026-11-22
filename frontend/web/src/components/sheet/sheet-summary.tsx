import { type ReactNode } from 'react';
import Link from 'next/link';
import { type CalendarDate } from '@sarmata/services';
import { Section, SummaryList } from '@sarmata/ui';
import { type SummaryRow } from '@sarmata/ui';
import { type CaseData } from '@/app/(app)/oceny/[id]/loader';
import { evaluationDueOn } from '@/lib/evaluations/next-step';
import { formatDate, formatScore, romanNumeral } from '@/lib/format';
import { criterionName, levelName } from '@/lib/regulation';
import { routes } from '@/lib/routes';

type SheetPart = 'one' | 'two' | 'three';

const NOT_ENTERED = 'Nie wpisano';

/** A text that keeps its line breaks and wraps at a readable width. */
function Prose({ children }: { children: string }) {
  return <span className="block max-w-[70ch] whitespace-pre-line">{children}</span>;
}

function lines(values: readonly string[]): ReactNode {
  return values.map((value, index) => (
    <span key={`${index}:${value}`} className="block">
      {value}
    </span>
  ));
}

function dateOrEmpty(value: CalendarDate | null): string {
  return value === null ? NOT_ENTERED : formatDate(value);
}

function textOrEmpty(value: string): ReactNode {
  return value.trim() === '' ? NOT_ENTERED : <Prose>{value}</Prose>;
}

function partOneRows({ view, regulation }: CaseData): SummaryRow[] {
  const { partOne } = view.sheet.content;
  const mandatory = regulation.criteria.filter((criterion) => criterion.mandatory);
  // The deadline slot, not the next step: that one is the objection or decision date later on.
  const dueOn = evaluationDueOn(view) ?? partOne.dueOn ?? null;
  return [
    { key: 'Kryteria obowiązkowe', value: lines(mandatory.map((criterion) => criterion.name)) },
    {
      key: 'Kryteria dodatkowe',
      value:
        partOne.additionalCriteria.length === 0
          ? 'Brak'
          : lines(partOne.additionalCriteria.map((id) => criterionName(regulation, id))),
    },
    {
      key: 'Termin sporządzenia oceny',
      value: dueOn === null ? NOT_ENTERED : formatDate(dueOn),
    },
  ];
}

function resultText({ view, regulation }: CaseData): string {
  const { mean, levelCode, outcome } = view.score;
  if (mean === null) return 'Wynik pojawi się po ocenie wszystkich kryteriów';
  const level = levelName(regulation, levelCode);
  const verdict = outcome === 'negative' ? 'ocena negatywna' : 'ocena pozytywna';
  return [formatScore(mean), level, verdict].filter(Boolean).join(', ');
}

function partTwoRows(data: CaseData, editable: boolean): SummaryRow[] {
  const { view, regulation } = data;
  const { partTwo } = view.sheet.content;
  const part2 = routes.evaluationPart2(view.id);
  const change = (fieldId: string) => (editable ? `${part2}#${fieldId}` : undefined);
  const period =
    partTwo.periodFrom !== null && partTwo.periodTo !== null
      ? `od ${formatDate(partTwo.periodFrom)} do ${formatDate(partTwo.periodTo)}`
      : NOT_ENTERED;

  const ratingRows = regulation.criteria.map((criterion): SummaryRow => {
    const points = partTwo.ratings[criterion.id];
    const level = regulation.scale.find((candidate) => candidate.value === points);
    return {
      key: criterion.name,
      value: points === undefined ? 'Brak oceny' : level ? `${points}, ${level.name}` : `${points}`,
      changeHref: change(`rating-${criterion.id}`),
    };
  });

  return [
    {
      key: 'Data rozmowy oceniającej',
      value: dateOrEmpty(partTwo.interviewOn),
      changeHref: change('interviewOn'),
    },
    { key: 'Okres oceny', value: period, changeHref: change('periodFrom') },
    ...ratingRows,
    { key: 'Wynik', value: resultText(data) },
    {
      key: 'Uzasadnienie',
      value: textOrEmpty(partTwo.justification),
      changeHref: change('justification'),
    },
    {
      key: 'Wnioski do IPRZ',
      value: textOrEmpty(partTwo.developmentConclusions),
      changeHref: change('developmentConclusions'),
    },
  ];
}

function partThreeRows({ view }: CaseData, editable: boolean): SummaryRow[] {
  const { gradeRequest } = view.sheet.content.partTwo;
  const href = editable ? `${routes.evaluationPart3(view.id)}#gradeRequest` : undefined;
  const rows: SummaryRow[] = [
    {
      key: 'Wniosek o stopień',
      value:
        gradeRequest === null
          ? 'Brak wniosku'
          : `O stopień ${romanNumeral(gradeRequest.requestedGrade)}`,
      changeHref: href,
    },
  ];
  if (gradeRequest !== null) {
    rows.push({
      key: 'Umotywowanie',
      value: textOrEmpty(gradeRequest.motivation),
      changeHref: editable
        ? `${routes.evaluationPart3(view.id)}#gradeRequestMotivation`
        : undefined,
    });
  }
  return rows;
}

const titles: Record<SheetPart, string> = {
  one: 'Część I',
  two: 'Część II',
  three: 'Część III',
};

/**
 * The sheet as three "check your answers" lists, one per part. "Zmień" links show only when
 * `editable`. `parts` picks and orders the lists, all three by default.
 */
export function SheetSummary({
  data,
  editable,
  parts = ['one', 'two', 'three'],
}: {
  data: CaseData;
  editable: boolean;
  parts?: readonly SheetPart[];
}) {
  const rowsOf: Record<SheetPart, () => SummaryRow[]> = {
    one: () => partOneRows(data),
    two: () => partTwoRows(data, editable),
    three: () => partThreeRows(data, editable),
  };
  return (
    <div className="flex flex-col">
      {parts.map((part) => (
        <Section key={part} title={titles[part]} titleLevel={3} id={`summary-${part}`}>
          <SummaryList rows={rowsOf[part]()} linkAs={Link} />
        </Section>
      ))}
    </div>
  );
}
