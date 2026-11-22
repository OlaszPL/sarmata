import type { Metadata } from 'next';
import Link from 'next/link';
import { type Services, servicesFor } from '@sarmata/services';
import { Notice, PageHero, Section } from '@sarmata/ui';
import { AskForm } from '@/components/help/ask-form';
import { Answer } from '@/components/help/answer';
import { Guide } from '@/components/help/guide';
import { requireMember } from '@/lib/account';
import { guidesFor } from '@/lib/help/guides';
import { evaluationIdOf, questionFromParams } from '@/lib/help/question';
import { regulationForEvaluation } from '@/lib/regulation';
import { routes } from '@/lib/routes';
import { type SearchParams, single } from '@/lib/search-params';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Pomoc' };

type CaseContext =
  | { kind: 'none' }
  | { kind: 'missing' }
  | { kind: 'found'; id: string; employeeName: string; regulationName: string };

/** The evaluation a question is about, with the name of the regulation version pinned to it. */
async function caseContext(services: Services, id: string | null): Promise<CaseContext> {
  if (id === null) return { kind: 'none' };
  try {
    const view = await services.evaluations.get(id);
    if (view === null) return { kind: 'missing' };
    const regulation = await regulationForEvaluation(view);
    return {
      kind: 'found',
      id: view.id,
      employeeName: `${view.snapshot.firstName} ${view.snapshot.lastName}`,
      regulationName: regulation.name,
    };
  } catch (error) {
    console.error('pomoc: evaluation of the question failed', error);
    return { kind: 'missing' };
  }
}

/** Step by step guides and the procedure assistant (`procedure_question`). */
export default async function HelpPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const account = await requireMember();
  const params = await searchParams;
  const services = servicesFor(await createSupabase());
  const isAdmin = account.role === 'admin';
  let settings: Awaited<ReturnType<typeof services.officeSettings.get>> | null = null;
  if (!isAdmin) {
    try {
      settings = await services.officeSettings.get();
    } catch (error) {
      // The guides stay usable, the AI state is unknown and `ai.start` answers `ai_disabled` if needed.
      console.error('pomoc: office settings failed', error);
    }
  }
  const aiOff = settings?.aiEnabled === false;

  const asked = isAdmin
    ? ({ kind: 'none' } as const)
    : await questionFromParams(
        { pytanie: single(params.pytanie) },
        (id) => services.ai.get(id),
        new Date(),
      );
  const rawCase = single(params.ocena);
  const caseId = evaluationIdOf(rawCase) ?? (asked.kind === 'found' ? asked.evaluationId : null);
  const context: CaseContext = isAdmin
    ? { kind: 'none' }
    : rawCase !== '' && caseId === null
      ? { kind: 'missing' }
      : await caseContext(services, caseId);

  return (
    <div className="flex flex-1 flex-col">
      <PageHero title="Pomoc" meta="Instrukcja krok po kroku i asystent przepisów." />
      <Section title="Zapytaj o przepisy" id="asystent">
        <div className="grid gap-6">
          <p className="max-w-[70ch]">
            Asystent odpowiada na podstawie ustawy o służbie cywilnej, rozporządzenia i zarządzenia
            {context.kind === 'found'
              ? ' w wersji, według której prowadzona jest ocena.'
              : ' w wersji obowiązującej w urzędzie.'}{' '}
            Odpowiedź to sugestia, decyzję podejmujesz Ty.
          </p>
          {context.kind === 'found' ? (
            <Notice tone="info" title={`Pytanie o ocenę: ${context.employeeName}`}>
              <p>Asystent odpowie według wersji przepisów, w której prowadzona jest ta ocena.</p>
              <p>Wersja przepisów: {context.regulationName}</p>
              <p>
                <Link href={routes.evaluation(context.id)} className="text-link underline">
                  Wróć do sprawy
                </Link>
              </p>
            </Notice>
          ) : null}
          {context.kind === 'missing' ? (
            <Notice tone="warning" role="status">
              <p>
                Nie znaleziono tej oceny. Asystent odpowie według przepisów obowiązujących w
                urzędzie.
              </p>
            </Notice>
          ) : null}
          {isAdmin ? (
            <Notice tone="info">
              <p>Asystent przepisów odpowiada oceniającym i kadrom.</p>
            </Notice>
          ) : aiOff ? (
            <Notice tone="info">
              <p>AI jest wyłączone w ustawieniach urzędu. Instrukcja poniżej działa bez AI.</p>
            </Notice>
          ) : (
            <AskForm
              defaultQuestion={asked.kind === 'found' ? asked.question : ''}
              evaluationId={context.kind === 'found' ? context.id : null}
            />
          )}
          {asked.kind === 'missing' ? (
            <Notice tone="warning" role="status">
              <p>Nie znaleziono tego pytania. Zadaj je jeszcze raz.</p>
            </Notice>
          ) : null}
          {asked.kind === 'found' ? (
            <Answer
              runId={asked.runId}
              question={asked.question}
              state={asked.state}
              canDecide={!isAdmin}
              decisionFailed={params.blad === '1'}
              evaluationId={asked.evaluationId}
            />
          ) : null}
        </div>
      </Section>
      {guidesFor(account.role).map((guide) => (
        <Guide key={guide.id} guide={guide} />
      ))}
    </div>
  );
}
