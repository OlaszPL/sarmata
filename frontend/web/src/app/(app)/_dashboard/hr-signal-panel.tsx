import Link from 'next/link';
import { AiMark } from '@sarmata/ui';
import { CONVERSATION_PREP_ANCHOR } from '@/components/ai/conversation-prep';
import { type DashboardData } from '@/lib/dashboard/compose-dashboard';
import { routes } from '@/lib/routes';

interface HrSignalPanelProps {
  signal: DashboardData['hrSignal'];
  aiEnabled: boolean;
}

/** The strongest burnout or overload signal among the evaluator's people, as a suggestion only. */
export function HrSignalPanel({ signal, aiEnabled }: HrSignalPanelProps) {
  return (
    <section
      aria-labelledby="hr-signal-heading"
      className="border-rule flex flex-col gap-3 border-b px-7 py-6"
    >
      <h2
        id="hr-signal-heading"
        className="flex items-center gap-2.5 text-xl leading-[normal] font-semibold"
      >
        <AiMark className="size-4 shrink-0" />
        Warto porozmawiać
      </h2>
      {!aiEnabled ? (
        <p className="leading-6">AI jest wyłączone w urzędzie. Sugestie rozmów się nie pojawią.</p>
      ) : !signal ? (
        <p className="leading-6">
          Brak sygnałów do rozmowy. Gdy AI zauważy coś w notatkach, zobaczysz to tutaj.
        </p>
      ) : (
        <>
          <Link
            href={routes.employee(signal.employeeId)}
            className="font-heading text-navy self-start text-lg leading-[normal] font-semibold underline"
          >
            {signal.employeeName}
          </Link>
          <p className="leading-6">{signal.signal.label}</p>
          {signal.signal.quote ? (
            <blockquote className="border-rule border-l-[3px] pl-4 leading-6">
              {signal.signal.quote}
            </blockquote>
          ) : null}
          <p className="flex flex-wrap items-center gap-x-3">
            <span className="font-heading text-navy text-[1.75rem] leading-[normal] font-semibold">
              {Math.round(signal.signal.probability * 100)}%
            </span>
            <span className="text-ink-muted text-sm leading-[normal]">
              prawdopodobieństwo według Bielik-One
            </span>
          </p>
          <p className="text-sm leading-[normal] font-semibold">
            Sugestia AI. Decyzję podejmujesz Ty.
          </p>
          <div className="flex flex-wrap">
            <Link
              href={`${routes.employee(signal.employeeId)}#${CONVERSATION_PREP_ANCHOR}`}
              className="bg-navy font-heading flex h-11 items-center px-4 leading-[normal] font-semibold text-white no-underline"
            >
              Przygotuj rozmowę
            </Link>
            <Link
              href={routes.employee(signal.employeeId)}
              className="border-rule font-heading text-ink flex h-11 items-center border bg-white px-4 leading-[normal] font-medium no-underline"
            >
              Nie zgadzam się
            </Link>
          </div>
        </>
      )}
    </section>
  );
}
