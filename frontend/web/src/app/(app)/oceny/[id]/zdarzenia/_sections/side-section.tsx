import { type CalendarDate, type TermChangeReason } from '@sarmata/services';
import { DataTable, Notice, Section } from '@sarmata/ui';
import { levelName } from '@/lib/case-regulation';
import { formatDate, pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';
import type { CaseData } from '../../loader';
import {
  changeEvaluator,
  changeTerm,
  correctSheet,
  recordAbsence,
  recordPositionChange,
  recordReturn,
} from '../actions';
import {
  AbsenceForm,
  CorrectionForm,
  EvaluatorChangeForm,
  PositionChangeForm,
  ReturnForm,
  TermChangeForm,
} from '../_forms/side-forms';
import {
  type EventPanel,
  type SideEventRow,
  absencesOf,
  OPEN_STATUSES,
  termChangeReasonLabels,
} from '../panels';
import { sheetValues } from './initial-values';

export interface SideProps {
  data: CaseData;
  panels: ReadonlySet<EventPanel>;
  rows: readonly SideEventRow[];
  termChange: { reasons: readonly TermChangeReason[]; minimumElapsedMonths: number };
  /** Accounts that may take over the evaluation, without the current evaluator. */
  people: { accountId: string; name: string }[];
}

/** The same day number N months later, the last day of the month when there is none. */
function addMonths(from: CalendarDate, months: number): CalendarDate {
  const [year, month, day] = from.split('-').map(Number) as [number, number, number];
  const index = year * 12 + (month - 1) + months;
  const newYear = Math.floor(index / 12);
  const newMonth = (index % 12) + 1;
  const lastDay = new Date(Date.UTC(newYear, newMonth, 0)).getUTCDate();
  const text = [newYear, newMonth, Math.min(day, lastDay)]
    .map((part, position) => String(part).padStart(position === 0 ? 4 : 2, '0'))
    .join('-');
  return text as CalendarDate;
}

function SideEventsTable({
  view,
  rows,
}: {
  view: CaseData['view'];
  rows: readonly SideEventRow[];
}) {
  return (
    <DataTable<SideEventRow>
      caption="Zdarzenia boczne tej oceny"
      rows={[...rows]}
      rowKey={(row) => row.id}
      empty={<p>Nie odnotowano zdarzeń bocznych.</p>}
      columns={[
        { key: 'label', header: 'Zdarzenie', rowHeader: true, cell: (row) => row.label },
        { key: 'occurredOn', header: 'Data', cell: (row) => row.occurredOn },
        { key: 'details', header: 'Szczegóły', cell: (row) => row.details },
        {
          key: 'document',
          header: 'Dokument',
          cell: (row) =>
            row.noticeEventId === null ? null : (
              // A plain link: a file download, not a page of the app.
              <a
                href={routes.evaluationExport(view.id, 'zawiadomienie', {
                  zdarzenie: row.noticeEventId,
                })}
                className="text-link underline"
              >
                Zawiadomienie PDF
              </a>
            ),
        },
      ]}
    />
  );
}

function TermChange({ data, termChange }: Pick<SideProps, 'data' | 'termChange'>) {
  const { view, today } = data;
  if (view.afterNegative) {
    return <Notice tone="info">Po ocenie negatywnej terminu nie można zmienić.</Notice>;
  }
  const earliest = addMonths(view.cycleStart, termChange.minimumElapsedMonths);
  const months = termChange.minimumElapsedMonths;
  return (
    <TermChangeForm
      action={changeTerm.bind(null, view.id)}
      initial={{ values: { noticeOn: today }, fieldErrors: {} }}
      reasons={termChange.reasons.map((value) => ({
        value,
        label: termChangeReasonLabels[value],
      }))}
      hint={`Zawiadomienie musi mieć datę późniejszą niż ${formatDate(earliest)}, bo od początku cyklu musi minąć ${String(months)} ${pluralPl(months, 'miesiąc', 'miesiące', 'miesięcy')}.`}
    />
  );
}

/** "Zdarzenia boczne": the table of the side events and, for a writer of an open case, their forms. */
export function SideSection({ data, panels, rows, termChange, people }: SideProps) {
  const { view, today } = data;
  const ongoing = absencesOf(view.events).filter((absence) => absence.to === null);
  return (
    <Section title="Zdarzenia boczne">
      <div className="flex flex-col gap-8">
        <SideEventsTable view={view} rows={rows} />
        {panels.has('sideEvents') ? (
          <div className="flex flex-col gap-4">
            <AbsenceForm
              action={recordAbsence.bind(null, view.id)}
              initial={{ values: { from: today }, fieldErrors: {} }}
            />
            {ongoing.map((absence) => (
              <ReturnForm
                key={absence.absenceId}
                action={recordReturn.bind(null, view.id)}
                initial={{ values: { to: today }, fieldErrors: {} }}
                absence={{
                  absenceId: absence.absenceId,
                  from: absence.from,
                  fromText: formatDate(absence.from),
                }}
              />
            ))}
            <TermChange data={data} termChange={termChange} />
            <PositionChangeForm
              action={recordPositionChange.bind(null, view.id)}
              initial={{
                values: {
                  changedOn: today,
                  positionTitle: view.currentPosition.positionTitle ?? '',
                  orgUnit: view.currentPosition.orgUnit ?? '',
                },
                fieldErrors: {},
              }}
            />
            {panels.has('evaluatorChange') ? (
              <EvaluatorChangeForm
                action={changeEvaluator.bind(null, view.id)}
                initial={{ values: { occurredOn: today }, fieldErrors: {} }}
                people={people}
              />
            ) : null}
          </div>
        ) : OPEN_STATUSES.has(view.status) ? (
          <Notice tone="info">
            Zdarzenia boczne odnotowuje osoba prowadząca ocenę albo kadry.
          </Notice>
        ) : null}
      </div>
    </Section>
  );
}

/** "Korekta arkusza": administrator only, on a locked sheet. */
export function CorrectionSection({ data }: { data: CaseData }) {
  const { view, regulation } = data;
  const level = levelName(regulation, view.score.levelCode);
  return (
    <Section title="Korekta arkusza">
      <div className="flex flex-col gap-8">
        <Notice tone="info">
          Korekta tworzy nową wersję arkusza i wpis w dzienniku.
          {level ? ` Obecny poziom oceny to ${level}.` : ''}
        </Notice>
        <CorrectionForm
          action={correctSheet.bind(null, view.id)}
          initial={{ values: sheetValues(view), fieldErrors: {} }}
          criteria={regulation.criteria}
          scale={regulation.scale}
        />
      </div>
    </Section>
  );
}
