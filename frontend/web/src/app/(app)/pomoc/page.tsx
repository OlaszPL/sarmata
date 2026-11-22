import type { Metadata } from 'next';
import { servicesFor } from '@sarmata/services';
import { Notice, PageHero, Section } from '@sarmata/ui';
import { AskForm } from '@/components/help/ask-form';
import { Answer } from '@/components/help/answer';
import { Guide } from '@/components/help/guide';
import { requireMember } from '@/lib/account';
import { guidesFor } from '@/lib/help/guides';
import { QUESTION_MAX, questionFromParams } from '@/lib/help/question';
import { type SearchParams, single } from '@/lib/search-params';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Pomoc' };

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
  const tresc = single(params.tresc).slice(0, QUESTION_MAX);

  const asked = isAdmin
    ? ({ kind: 'none' } as const)
    : await questionFromParams(
        { pytanie: single(params.pytanie), tresc },
        (id) => services.ai.get(id),
        new Date(),
      );

  return (
    <div className="flex flex-1 flex-col">
      <PageHero title="Pomoc" meta="Instrukcja krok po kroku i asystent przepisów." />
      <Section title="Zapytaj o przepisy" id="asystent">
        <div className="grid gap-6">
          <p className="max-w-[70ch]">
            Asystent odpowiada na podstawie ustawy o służbie cywilnej, rozporządzenia i zarządzenia
            w wersji obowiązującej w urzędzie. Odpowiedź to sugestia, decyzję podejmujesz Ty.
          </p>
          {isAdmin ? (
            <Notice tone="info">
              <p>Asystent przepisów odpowiada oceniającym i kadrom.</p>
            </Notice>
          ) : aiOff ? (
            <Notice tone="info">
              <p>AI jest wyłączone w ustawieniach urzędu. Instrukcja poniżej działa bez AI.</p>
            </Notice>
          ) : (
            <AskForm defaultQuestion={tresc} />
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
