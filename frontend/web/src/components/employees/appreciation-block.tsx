import { Notice, PixelLoader } from '@sarmata/ui';
import { PollingRefresh } from '@/components/polling-refresh';
import { pluralPl } from '@/lib/format';
import { type AppreciationModel } from '@/lib/employees/hr-partner';
import { AiStartForm } from './ai-panel-actions';

export const POLLING_TIMEOUT = 'Analiza trwa dłużej niż zwykle. Odśwież stronę później.';

interface AppreciationBlockProps {
  employeeId: string;
  /** The latest finished search, null before the first one. */
  model: AppreciationModel | null;
  running: boolean;
  /** The newest search failed. An older finished result still shows above the failure. */
  failed: boolean;
  /** Refreshes the page while the search runs, off when the signals analysis already polls. */
  poll: boolean;
  canAnalyse: boolean;
}

function days(n: number): string {
  return `${n} ${pluralPl(n, 'dzień', 'dni', 'dni')}`;
}

function Gap({ model }: { model: AppreciationModel }) {
  if (model.lastOn === null) return <p className="leading-6">Brak notatki z docenieniem.</p>;
  if (model.overdue && model.daysSince !== null) {
    return (
      <div className="grid gap-1">
        <p className="font-heading text-ink text-[1.0625rem] leading-[normal] font-semibold">
          Długo bez docenienia
        </p>
        <p className="text-[0.9375rem] leading-[1.4375rem]">
          {days(model.daysSince)} od ostatniego docenienia, próg urzędu to{' '}
          {days(model.thresholdDays)}.
        </p>
      </div>
    );
  }
  return (
    <p className="text-[0.9375rem] leading-[1.4375rem]">
      Ostatnia notatka z docenieniem jest z {model.lastOn}.
    </p>
  );
}

/**
 * Moment na docenienie: how long since the last appreciation note and situations from the notes worth
 * a word of appreciation, found by the AI on request.
 */
export function AppreciationBlock({
  employeeId,
  model,
  running,
  failed,
  poll,
  canAnalyse,
}: AppreciationBlockProps) {
  return (
    <section
      aria-labelledby="appreciation-heading"
      className="flex flex-col items-start gap-3 px-7 py-5"
    >
      <h3
        id="appreciation-heading"
        className="text-ink text-[1.1875rem] leading-[normal] font-semibold"
      >
        Moment na docenienie
      </h3>
      {model ? (
        <>
          <Gap model={model} />
          {model.moments.length > 0 ? (
            <ul className="grid gap-3">
              {model.moments.map((moment, index) => (
                <li key={index} className="border-ink grid gap-1 border-l-[3px] pl-3">
                  <p className="text-[0.9375rem] leading-[1.4375rem]">{moment.situation}</p>
                  <p className="text-ink-muted text-sm leading-5">{moment.reason}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[0.9375rem] leading-[1.4375rem]">
              Analiza nie znalazła w notatkach sytuacji do docenienia.
            </p>
          )}
        </>
      ) : running || failed ? null : (
        <p className="max-w-[70ch] text-[0.9375rem] leading-[1.4375rem]">
          Analiza wskaże w notatkach sytuacje, za które warto docenić tę osobę.
        </p>
      )}
      {running ? (
        <>
          <PixelLoader label="Szukam momentu na docenienie. Wynik pojawi się tu sam." />
          {poll ? (
            <PollingRefresh active intervalMs={2000} timeoutMessage={POLLING_TIMEOUT} />
          ) : null}
        </>
      ) : failed ? (
        <Notice tone="error" role="status">
          <div className="grid justify-items-start gap-3">
            <p>Szukanie momentu na docenienie się nie udało. Spróbuj ponownie.</p>
            {canAnalyse ? (
              <AiStartForm
                employeeId={employeeId}
                kind="appreciation_moments"
                label="Szukaj ponownie"
              />
            ) : null}
          </div>
        </Notice>
      ) : canAnalyse ? (
        <AiStartForm
          employeeId={employeeId}
          kind="appreciation_moments"
          label="Znajdź moment na docenienie"
        />
      ) : null}
    </section>
  );
}
