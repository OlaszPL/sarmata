import type { Metadata } from 'next';
import { type EvaluationView, servicesFor } from '@sarmata/services';
import { Notice, Section, SummaryList, type SummaryRow } from '@sarmata/ui';
import { ConversationPrepPanel } from '@/components/ai/conversation-prep-panel';
import { loadConversationPrep } from '@/components/ai/conversation-prep-load';
import { criterionName } from '@/lib/case-regulation';
import { formatDate } from '@/lib/format';
import { approvalIssueItems } from '@/lib/service-errors';
import { createSupabase } from '@/lib/supabase';
import { type CaseData, caseTitle, loadCase } from '../loader';
import { recordSignature, savePartOne } from './actions';
import { latestDueOn } from './part-one';
import { PartOneForm } from './part-one-form';
import { SignatureForm } from './signature-form';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Część I') };
}

function lastEvent(view: EvaluationView, kind: string) {
  return view.events.filter((event) => event.kind === kind).at(-1) ?? null;
}

function slotOf(view: EvaluationView, slots: readonly string[]) {
  return view.deadlines.find((deadline) => slots.includes(deadline.slot)) ?? null;
}

function NameList({ names }: { names: readonly string[] }) {
  if (names.length === 0) return <>Nie wybrano</>;
  return (
    <ul className="flex flex-col gap-1">
      {names.map((name) => (
        <li key={name}>{name}</li>
      ))}
    </ul>
  );
}

function dueOnText(view: EvaluationView): string {
  const deadline = slotOf(view, ['evaluationDeadline', 'reevaluationAfterNegative']);
  if (deadline?.dueOn) return formatDate(deadline.dueOn);
  if (deadline?.suspendedSince) {
    return `Wstrzymany od ${formatDate(deadline.suspendedSince)} z powodu nieobecności`;
  }
  const chosen = view.sheet.content.partOne.dueOn;
  return chosen ? formatDate(chosen) : 'Termin z przepisów';
}

/** Part I as saved: criteria, due date and, once they happened, the approval and the signature. */
function PartOneSummary({ data }: { data: CaseData }) {
  const { view, regulation } = data;
  const names = (ids: readonly string[]) => ids.map((id) => criterionName(regulation, id));
  const approved = lastEvent(view, 'part_one_approved');
  const signed = lastEvent(view, 'part_one_signed');
  const place = approved?.payload.place;

  const rows: SummaryRow[] = [
    { key: 'Kryteria obowiązkowe', value: <NameList names={names(regulation.mandatoryIds)} /> },
    {
      key: 'Kryteria dodatkowe',
      value: <NameList names={names(view.sheet.content.partOne.additionalCriteria)} />,
    },
    { key: 'Termin oceny', value: dueOnText(view) },
  ];
  if (approved) {
    rows.push({
      key: 'Rozmowa rozpoczynająca',
      value:
        typeof place === 'string' && place !== ''
          ? `${formatDate(approved.occurredOn)}, ${place}`
          : formatDate(approved.occurredOn),
    });
  }
  if (signed) rows.push({ key: 'Podpisana', value: formatDate(signed.occurredOn) });
  return <SummaryList rows={rows} />;
}

async function EditForm({ data }: { data: CaseData }) {
  const { view, regulation, today } = data;
  const services = servicesFor(await createSupabase());
  const [document, settings] = await Promise.all([
    services.regulations.forEvaluation(view.id),
    services.officeSettings.get(),
  ]);
  const latest = latestDueOn(view, document);
  const interview = slotOf(view, ['startingInterview', 'startingInterviewAfterNegative']);
  const names = (id: string) => criterionName(regulation, id);
  const { partOne } = view.sheet.content;

  return (
    <PartOneForm
      action={savePartOne.bind(null, view.id)}
      initial={{
        values: {
          additionalCriteria: [...partOne.additionalCriteria],
          dueOn: partOne.dueOn ?? '',
          startingInterviewOn: today,
          place: settings.defaultPlace ?? '',
        },
        fieldErrors: {},
      }}
      mandatory={regulation.mandatoryIds.map((id) => ({ id, name: names(id) }))}
      options={regulation.catalog.filter(
        (criterion) => !regulation.mandatoryIds.includes(criterion.id),
      )}
      additionalMin={regulation.additionalMin}
      additionalMax={regulation.additionalMax}
      latestDueOn={latest}
      latestDueOnText={latest ? formatDate(latest) : null}
      startingInterviewDueText={interview?.dueOn ? formatDate(interview.dueOn) : null}
      pendingIssues={approvalIssueItems(data.approval.issues, names)}
    />
  );
}

function closedNotice(view: EvaluationView): string {
  if (view.status === 'interrupted' && lastEvent(view, 'part_one_approved') === null) {
    return 'Ocena jest przerwana. Części I nie można już zmienić.';
  }
  return 'Część I jest zatwierdzona i nie można jej zmienić.';
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const data = await loadCase((await params).id);
  const { view, canWrite, today } = data;
  const open = view.status === 'criteria' || view.status === 'criteria_awaiting_signature';

  let content;
  if (open && !canWrite) {
    content = (
      <>
        <Notice tone="info">Część I wypełnia osoba prowadząca ocenę. Możesz ją przeglądać.</Notice>
        <PartOneSummary data={data} />
      </>
    );
  } else if (view.status === 'criteria') {
    content = <EditForm data={data} />;
  } else if (view.status === 'criteria_awaiting_signature') {
    content = (
      <>
        <PartOneSummary data={data} />
        <SignatureForm
          action={recordSignature.bind(null, view.id)}
          initial={{ values: { signedOn: today }, fieldErrors: {} }}
        />
      </>
    );
  } else {
    content = (
      <>
        <Notice tone="info">{closedNotice(view)}</Notice>
        <PartOneSummary data={data} />
      </>
    );
  }

  // The starting conversation is prepared before part I is approved, for the evaluator and hr.
  const role = data.account.role;
  const showPrep = view.status === 'criteria' && (role === 'evaluator' || role === 'hr');
  const prep = showPrep
    ? await loadConversationPrep(view.employeeId, {
        evaluationId: view.id,
        after: lastEvent(view, 'part_one_approved')?.recordedAt ?? null,
      })
    : null;

  return (
    <Section title="Część I. Kryteria i termin">
      <div className="flex flex-col gap-8">
        {prep ? (
          <ConversationPrepPanel
            employeeId={view.employeeId}
            conversation="starting"
            evaluationId={view.id}
            criterionNames={Object.fromEntries(
              data.regulation.catalog.map((criterion) => [criterion.id, criterion.name]),
            )}
            initial={prep}
          />
        ) : null}
        {content}
      </div>
    </Section>
  );
}
