import Link from 'next/link';
import { AiMark } from '@sarmata/ui';
import { type DashboardData } from '@/lib/dashboard/compose-dashboard';
import { routes } from '@/lib/routes';

interface HrSignalPanelProps {
  signal: DashboardData['hrSignal'];
  aiEnabled: boolean;
}

/** The strongest burnout or overload signal among the evaluator's people, as a suggestion only. */
export function HrSignalPanel({ signal, aiEnabled }: HrSignalPanelProps) {
  return (
    <section aria-labelledby="hr-signal-heading" className="border-rule border-b px-6 py-8">
      <h2 id="hr-signal-heading" className="flex items-center gap-3 text-xl font-semibold">
        <AiMark className="size-4 shrink-0" />
        Warto porozmawiać
      </h2>
      {!aiEnabled ? (
        <p className="mt-3">AI jest wyłączone w urzędzie. Sugestie rozmów się nie pojawią.</p>
      ) : !signal ? (
        <p className="mt-3">
          Brak sygnałów do rozmowy. Gdy AI zauważy coś w notatkach, zobaczysz to tutaj.
        </p>
      ) : (
        <>
          <Link
            href={routes.employee(signal.employeeId)}
            className="font-heading text-link mt-3 inline-block text-lg font-semibold underline"
          >
            {signal.employeeName}
          </Link>
          <p className="mt-2 font-semibold">{signal.signal.label}</p>
          {signal.signal.quote ? (
            <blockquote className="border-rule mt-2 border-l-[3px] pl-4">
              {signal.signal.quote}
            </blockquote>
          ) : null}
          <p className="mt-4 flex flex-wrap items-baseline gap-x-3">
            <span className="font-heading text-navy text-[1.75rem] leading-none font-semibold">
              {Math.round(signal.signal.probability * 100)}%
            </span>
            <span className="text-ink-muted text-sm">prawdopodobieństwo według Bielik-One</span>
          </p>
          <p className="mt-4 text-sm font-semibold">Sugestia AI. Decyzję podejmujesz Ty.</p>
          <div className="mt-3 flex flex-wrap">
            <Link
              href={routes.employee(signal.employeeId)}
              className="bg-navy border-navy font-heading border px-4 py-2.5 font-semibold text-white no-underline"
            >
              Przygotuj rozmowę
            </Link>
            <Link
              href={routes.employee(signal.employeeId)}
              className="border-rule font-heading text-ink border bg-white px-4 py-2.5 font-semibold no-underline"
            >
              Nie zgadzam się
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
