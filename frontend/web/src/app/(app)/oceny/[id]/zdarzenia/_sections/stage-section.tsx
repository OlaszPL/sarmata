import { type CalendarDate, type EvaluationView } from '@sarmata/services';
import { Notice, Section, SummaryList, type SummaryRow } from '@sarmata/ui';
import type { CaseData } from '../../loader';
import { formatDate, relativeDays } from '@/lib/format';
import { levelName } from '@/lib/case-regulation';
import {
  closeEvaluation,
  decideObjection,
  fileObjection,
  interruptEvaluation,
  recordAcquaintance,
} from '../actions';
import {
  AcquaintanceForm,
  ClosingForm,
  InterruptionForm,
  ObjectionDecisionForm,
  ObjectionFilingForm,
} from '../_forms/stage-forms';
import { type EventPanel, objectionOutcomeLabels, objectionWindow } from '../panels';
import { lastEventOf, sheetValues, textOf } from './initial-values';

interface StageProps {
  data: CaseData;
  panels: ReadonlySet<EventPanel>;
  defaultPlace: string | null;
}

function slotDue(view: EvaluationView, slot: string): CalendarDate | null {
  return view.deadlines.find((deadline) => deadline.slot === slot)?.dueOn ?? null;
}

function AcquaintanceSummary({ view }: { view: EvaluationView }) {
  const event = lastEventOf(view, ['acquainted', 'signature_refused']);
  if (event === null) return null;
  const refused = event.kind === 'signature_refused';
  const witnesses = Array.isArray(event.payload.witnesses)
    ? event.payload.witnesses.filter((item): item is string => typeof item === 'string')
    : [];
  const rows: SummaryRow[] = [
    { key: 'Data zapoznania', value: formatDate(event.occurredOn) },
    {
      key: 'Podpis',
      value: refused ? 'Osoba oceniana odmówiła podpisu' : 'Osoba oceniana podpisała',
    },
  ];
  const note = textOf(event.payload.refusalNote);
  if (refused && note !== '') rows.push({ key: 'Adnotacja o odmowie podpisu', value: note });
  if (witnesses.length > 0) {
    rows.push({
      key: 'Osoby obecne',
      value: (
        <ul className="flex flex-col gap-1">
          {witnesses.map((name) => (
            <li key={name}>{name}</li>
          ))}
        </ul>
      ),
    });
  }
  const place = textOf(event.payload.place);
  if (place !== '') rows.push({ key: 'Miejscowość', value: place });
  return <SummaryList rows={rows} />;
}

function Delivered({ data, panels }: Omit<StageProps, 'defaultPlace'>) {
  const { view, today } = data;
  const window = objectionWindow(view, today);
  const dueText = window ? formatDate(window.dueOn) : null;
  return (
    <>
      <AcquaintanceSummary view={view} />
      {window ? (
        <Notice tone="info">
          {window.open
            ? `Sprzeciw do ${formatDate(window.dueOn)}, ${relativeDays(window.daysLeft)}.${
                panels.has('closing') ? ' Ocenę zamkniesz, gdy ten termin minie.' : ''
              }`
            : `Termin na sprzeciw minął ${formatDate(window.dueOn)}.`}
        </Notice>
      ) : null}
      {view.objectionAddressee ? (
        <SummaryList rows={[{ key: 'Adresat sprzeciwu', value: view.objectionAddressee }]} />
      ) : null}
      {window?.open && panels.has('closing') ? null : panels.has('closing') ? (
        // Closing needs the objection window to be over, so the form waits for it.
        <ClosingForm
          action={closeEvaluation.bind(null, view.id)}
          initial={{ values: { closedOn: today }, fieldErrors: {} }}
          dueText={dueText}
        />
      ) : (
        <Notice tone="info">Ocenę zamyka osoba prowadząca ocenę albo kadry.</Notice>
      )}
      {panels.has('objectionFiling') ? (
        <ObjectionFilingForm
          action={fileObjection.bind(null, view.id)}
          initial={{ values: { filedOn: today }, fieldErrors: {} }}
          dueText={dueText}
        />
      ) : (
        <Notice tone="info">Wniesienie sprzeciwu odnotowują kadry.</Notice>
      )}
    </>
  );
}

function Objection({ data, panels }: Omit<StageProps, 'defaultPlace'>) {
  const { view, regulation, today } = data;
  const filed = lastEventOf(view, ['objection_filed']);
  const rows: SummaryRow[] = [];
  if (filed) rows.push({ key: 'Sprzeciw wniesiony', value: formatDate(filed.occurredOn) });
  const decisionDue = slotDue(view, 'objectionDecision');
  if (decisionDue) rows.push({ key: 'Termin rozpatrzenia', value: formatDate(decisionDue) });
  return (
    <>
      <SummaryList rows={rows} />
      {panels.has('objectionDecision') ? (
        <ObjectionDecisionForm
          action={decideObjection.bind(null, view.id)}
          initial={{ values: { decidedOn: today, ...sheetValues(view) }, fieldErrors: {} }}
          criteria={regulation.criteria}
          scale={regulation.scale}
          currentLevel={levelName(regulation, view.score.levelCode)}
        />
      ) : (
        <Notice tone="info">Sprzeciw rozpatrują kadry.</Notice>
      )}
    </>
  );
}

function Closed({ view }: { view: EvaluationView }) {
  const event = lastEventOf(view, ['objection_outcome', 'closed']);
  const rows: SummaryRow[] = [];
  if (event?.kind === 'objection_outcome') {
    const outcome = textOf(event.payload.outcome);
    rows.push({ key: 'Sprzeciw rozpatrzono', value: formatDate(event.occurredOn) });
    rows.push({
      key: 'Wynik sprzeciwu',
      value: Object.hasOwn(objectionOutcomeLabels, outcome)
        ? objectionOutcomeLabels[outcome as keyof typeof objectionOutcomeLabels]
        : outcome,
    });
  } else if (event) {
    rows.push({ key: 'Ocena zamknięta', value: formatDate(event.occurredOn) });
  }
  const appealDue = slotDue(view, 'labourCourtAppeal');
  if (appealDue) {
    rows.push({ key: 'Odwołanie do sądu pracy', value: `do ${formatDate(appealDue)}` });
  }
  return (
    <>
      <AcquaintanceSummary view={view} />
      <SummaryList rows={rows} />
    </>
  );
}

function Interrupted({ view }: { view: EvaluationView }) {
  const event = lastEventOf(view, ['interrupted']);
  const reason = textOf(event?.payload.reason);
  return (
    <Notice tone="warning">
      {event ? `Ocena przerwana ${formatDate(event.occurredOn)}.` : 'Ocena jest przerwana.'}
      {reason === '' ? '' : ` Powód: ${reason}`}
    </Notice>
  );
}

/** "Zapoznanie i sprzeciw": the form or summary of the current stage of the evaluation. */
export function StageSection({ data, panels, defaultPlace }: StageProps) {
  const { view, today } = data;
  let content;
  switch (view.status) {
    case 'drafted':
      content = panels.has('acquaintance') ? (
        <AcquaintanceForm
          action={recordAcquaintance.bind(null, view.id)}
          initial={{
            values: { acquaintedOn: today, place: defaultPlace ?? '' },
            fieldErrors: {},
          }}
        />
      ) : (
        <Notice tone="info">Zapoznanie odnotowuje osoba prowadząca ocenę albo kadry.</Notice>
      );
      break;
    case 'delivered':
      content = <Delivered data={data} panels={panels} />;
      break;
    case 'objection':
      content = <Objection data={data} panels={panels} />;
      break;
    case 'closed':
      content = <Closed view={view} />;
      break;
    case 'interrupted':
      content = <Interrupted view={view} />;
      break;
    default:
      content = (
        <Notice tone="info">Zapoznanie odnotujesz po zatwierdzeniu arkusza w części II.</Notice>
      );
  }
  return (
    <Section title="Zapoznanie i sprzeciw">
      <div className="flex flex-col gap-8">{content}</div>
    </Section>
  );
}

/** "Przerwanie oceny": the effect of the interruption and its form, for kadry only. */
export function InterruptionSection({ data }: { data: CaseData }) {
  const { view, today } = data;
  return (
    <Section title="Przerwanie oceny">
      <div className="flex flex-col gap-8">
        <Notice tone="warning">Przerwanie kończy ocenę bez wyniku. Nie można go cofnąć.</Notice>
        <InterruptionForm
          action={interruptEvaluation.bind(null, view.id)}
          initial={{ values: { interruptedOn: today }, fieldErrors: {} }}
        />
      </div>
    </Section>
  );
}
