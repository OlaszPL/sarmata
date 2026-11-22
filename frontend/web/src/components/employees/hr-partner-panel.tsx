import type { ReactNode } from 'react';
import { AiMark, Notice, PixelLoader, Tag } from '@sarmata/ui';
import { PollingRefresh } from '@/components/polling-refresh';
import { type AiPanelState, type HrSignalsResult } from '@/lib/employees/hr-partner';
import { type CardData } from '@/lib/employees/load-card';
import { AiStartForm, RejectSignalForm } from './ai-panel-actions';
import { AppreciationBlock, POLLING_TIMEOUT } from './appreciation-block';

const block = 'border-rule flex flex-col border-b px-7 py-5';
const subheading = 'text-ink text-[1.1875rem] leading-[normal] font-semibold';

interface HrPartnerPanelProps {
  data: CardData;
  /** Evaluator and hr who read the notes of this person may start an analysis and decide. */
  canAnalyse: boolean;
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** The result shown in the panel: the finished one, or the previous one while a new one runs. */
function shownResult(state: AiPanelState): HrSignalsResult | null {
  if (state.kind === 'done') return state.result;
  if (state.kind === 'running' || state.kind === 'failed') return state.previous;
  return null;
}

function Signals({
  result,
  employeeId,
  canDecide,
}: {
  result: HrSignalsResult;
  employeeId: string;
  canDecide: boolean;
}) {
  return (
    <>
      {result.signals.map((signal) => (
        <section
          key={signal.name}
          aria-labelledby={`signal-${signal.name}`}
          className={`${block} gap-2`}
        >
          <div className="flex items-end justify-between gap-4">
            {/* Takes the focus after "Nie zgadzam się z sygnałem", whose button then goes away. */}
            <h3 id={`signal-${signal.name}`} tabIndex={-1} className={`${subheading} outline-none`}>
              {signal.label}
            </h3>
            <p className="font-heading text-navy text-[1.875rem] leading-[1.875rem] font-semibold tracking-[-0.0167em]">
              <span className="sr-only">Prawdopodobieństwo </span>
              {Math.round(signal.probability * 100)}%
            </p>
          </div>
          {signal.quotes.map((quote, index) => (
            <blockquote
              key={index}
              className="border-ink text-ink-muted border-l-[3px] pl-3 text-sm leading-5"
            >
              {quote.occurredOn ? `${quote.occurredOn}: ` : null}„{quote.quote}”
            </blockquote>
          ))}
          {signal.rejected ? (
            <div>
              <Tag tone="neutral">Odrzucono</Tag>
            </div>
          ) : canDecide ? (
            <RejectSignalForm employeeId={employeeId} runId={result.runId} signal={signal.name} />
          ) : null}
        </section>
      ))}
      {result.absent.length > 0 ? (
        <p className={`${block} text-[0.9375rem] leading-[1.4375rem]`}>
          Nie wykryto: {result.absent.map(lowerFirst).join(', ')}.
        </p>
      ) : null}
      {result.questions.length > 0 ? (
        <section aria-labelledby="hr-questions" className={`${block} gap-2.5`}>
          <h3 id="hr-questions" className={subheading}>
            Pytania do rozmowy wspierającej
          </h3>
          <ul className="grid gap-2.5 leading-6">
            {result.questions.map((question) => (
              <li key={question.fragment}>{question.text}</li>
            ))}
          </ul>
        </section>
      ) : null}
      {result.actions.length > 0 ? (
        <section aria-labelledby="hr-actions" className={`${block} gap-2.5`}>
          <h3 id="hr-actions" className={subheading}>
            Działania
          </h3>
          <ul className="grid gap-4">
            {result.actions.map((action) => (
              <li key={action.fragment} className="grid justify-items-start gap-1.5">
                <Tag tone="neutral">{action.framework}</Tag>
                <p className="text-[0.9375rem] leading-[1.4375rem]">{action.text}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}

const HELP =
  'Gdy rozmowa pokaże potrzebę wsparcia, wskaż program pomocy pracownikom albo medycynę pracy. Nie stawiaj diagnozy.';

/**
 * HR partner (mockup 2026-11-22-karta-pencil.html, right column): overload and burnout signals found
 * in the notes, questions for a supportive talk and actions, then the moment of appreciation. Every
 * result is a suggestion, each signal can be rejected on its own.
 */
export function HrPartnerPanel({ data, canAnalyse }: HrPartnerPanelProps) {
  const {
    signals: state,
    appreciation,
    appreciationRunning,
    appreciationFailed,
    enabled,
  } = data.ai;
  const employeeId = data.employee.id;
  const result = shownResult(state);

  let status: ReactNode = null;
  if (state.kind === 'disabled') {
    status = <p className="leading-6">AI jest wyłączone w ustawieniach urzędu.</p>;
  } else if (state.kind === 'no_access') {
    status = (
      <p className="max-w-[70ch] leading-6">
        Analizy HR partnera czytają autor, kadry i osoba prowadząca otwartą ocenę tej osoby.
      </p>
    );
  } else if (state.kind === 'none') {
    status = (
      <>
        <p className="max-w-[70ch] leading-6">
          Brak analizy notatek. Analiza pokaże sygnały przeciążenia, wypalenia lub spadku
          zaangażowania z pytaniami do rozmowy.
        </p>
        {canAnalyse ? (
          <AiStartForm employeeId={employeeId} kind="hr_signals" label="Przeanalizuj notatki" />
        ) : null}
      </>
    );
  } else if (state.kind === 'running') {
    status = (
      <>
        <PixelLoader label="Analizuję notatki. Wynik pojawi się tu sam." />
        <PollingRefresh active intervalMs={2000} timeoutMessage={POLLING_TIMEOUT} />
      </>
    );
  } else if (state.kind === 'failed') {
    status = (
      <Notice tone="error">
        <div className="grid justify-items-start gap-3">
          <p>Analiza się nie udała. Spróbuj ponownie.</p>
          {canAnalyse ? (
            <AiStartForm employeeId={employeeId} kind="hr_signals" label="Przeanalizuj ponownie" />
          ) : null}
        </div>
      </Notice>
    );
  }

  return (
    <aside
      aria-labelledby="hr-partner-heading"
      className="bg-band border-rule border-t lg:w-[24rem] lg:shrink-0 lg:border-t-0 lg:border-l"
    >
      <div className="bg-navy-dark flex flex-col gap-3 px-7 py-6 text-white">
        <h2
          id="hr-partner-heading"
          className="flex items-center gap-2.5 text-2xl leading-[normal] font-semibold"
        >
          <span className="flex size-6 shrink-0 items-center justify-center bg-white">
            <AiMark className="size-4" />
          </span>
          HR partner
        </h2>
        <p className="text-[0.9375rem] leading-[1.375rem]">
          Sugestia AI. Decyzję podejmujesz Ty.
          {result ? ` Analiza z ${result.analysedOn}.` : null}
        </p>
      </div>
      {status ? <div className={`${block} items-start gap-4`}>{status}</div> : null}
      {result ? <Signals result={result} employeeId={employeeId} canDecide={canAnalyse} /> : null}
      {result ? (
        <div className={`${block} items-start gap-3`}>
          {state.kind === 'done' && canAnalyse ? (
            <AiStartForm employeeId={employeeId} kind="hr_signals" label="Przeanalizuj ponownie" />
          ) : null}
          <p className="text-ink-muted text-sm leading-5">{HELP}</p>
        </div>
      ) : null}
      {/* Without access to the analyses the sentence above covers the appreciation search too. */}
      {enabled && state.kind !== 'no_access' ? (
        <AppreciationBlock
          employeeId={employeeId}
          model={appreciation}
          running={appreciationRunning}
          failed={appreciationFailed && !appreciationRunning}
          // One poller refreshes the page for both analyses.
          poll={appreciationRunning && state.kind !== 'running'}
          canAnalyse={canAnalyse}
        />
      ) : null}
    </aside>
  );
}
