import type { Metadata } from 'next';
import Link from 'next/link';
import { servicesFor } from '@sarmata/services';
import { Notice, Section } from '@sarmata/ui';
import { ReadOnlyNotice } from '@/components/sheet/read-only-notice';
import { SheetSummary } from '@/components/sheet/sheet-summary';
import { AiDraftPanel } from './_sheet/ai-draft-panel';
import { draftProposals, sheetDraftState } from '@/lib/evaluations/sheet-draft';
import { partTwoMode } from '@/lib/evaluations/sheet-access';
import { partTwoDefaults } from '@/lib/evaluations/sheet-form';
import { gateLinks } from '@/lib/evaluations/sheet-gates';
import { formatDate } from '@/lib/format';
import { criterionName } from '@/lib/regulation';
import { routes } from '@/lib/routes';
import { createSupabase } from '@/lib/supabase';
import { caseTitle, loadCase } from '../loader';
import { InterviewForm } from './_sheet/interview-form';
import { SheetEditor } from './_sheet/sheet-editor';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  return { title: await caseTitle((await params).id, 'Część II') };
}

/** Quiet failure of an optional read: the sheet works without hints and note dates. */
async function orNull<T>(read: () => Promise<T>): Promise<T | null> {
  try {
    return await read();
  } catch (error) {
    console.warn('czesc-2: optional read failed', error);
    return null;
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await loadCase(id);
  const { view, regulation } = data;
  const mode = partTwoMode(view.status, data.canWrite);

  if (mode === 'not_open') {
    return (
      <Section title="Część II. Ocena okresowa">
        <Notice tone="info" title="Część II otworzysz po podpisaniu części I">
          <p>
            Najpierw zatwierdź i podpisz{' '}
            <Link href={routes.evaluationPart1(id)} className="text-link underline">
              część I
            </Link>
            .
          </p>
        </Notice>
      </Section>
    );
  }

  if (mode === 'read') {
    return (
      <Section title="Część II. Ocena okresowa">
        <div className="flex flex-col gap-6">
          <ReadOnlyNotice data={data} />
          <SheetSummary data={data} editable={false} parts={['two']} />
        </div>
      </Section>
    );
  }

  const services = servicesFor(await createSupabase());
  const [hints, notes, runs, aiEnabled] = await Promise.all([
    orNull(() => services.development.recommend(id)),
    orNull(() => services.notes.listForEmployee(view.employeeId)),
    orNull(() => services.ai.list({ employeeId: view.employeeId, kind: 'sheet_draft' })),
    // The office settings may be closed to the evaluator: treat AI as enabled, `start` then says why not.
    orNull(async () => (await services.officeSettings.get()).aiEnabled),
  ]);
  const draftState = sheetDraftState({
    aiEnabled: aiEnabled ?? true,
    runs: runs ?? [],
    view,
    now: new Date(),
  });
  const caseCriteria = regulation.criteria.map((criterion) => criterion.id);
  const proposals =
    draftState.kind === 'done' ? draftProposals(draftState.run, caseCriteria) : null;
  const noteDates = Object.fromEntries(
    (notes ?? []).map((note) => [note.id, formatDate(note.occurredOn)]),
  );
  const issues = gateLinks(
    id,
    data.approval.issues,
    (criterionId) => criterionName(regulation, criterionId),
    'czesc-2',
  );

  return (
    <SheetEditor
      id={id}
      criteria={regulation.criteria}
      scale={regulation.scale}
      initial={partTwoDefaults(view)}
      mode={mode}
      issues={issues}
      hints={hints}
      draft={
        proposals && draftState.kind === 'done'
          ? { ratings: proposals.ratings, sentences: proposals.sentences, runId: draftState.run.id }
          : null
      }
      noteDates={noteDates}
      negativePoints={regulation.negativePoints}
      before={mode === 'period' ? <InterviewForm id={id} today={data.today} /> : undefined}
      aiPanel={
        <AiDraftPanel
          id={id}
          state={draftState}
          criterionNames={Object.fromEntries(
            regulation.criteria.map((criterion) => [criterion.id, criterion.name]),
          )}
        />
      }
    />
  );
}
