import Link from 'next/link';
import { ClipboardList } from 'lucide-react';
import { pluralPl } from '@/lib/format';
import { routes } from '@/lib/routes';

export interface HrTaskCount {
  total: number;
  overdue: number;
}

/** First block of the side band for hr: how many hr tasks wait in the hr panel. */
export function HrTasksPanel({ count }: { count: HrTaskCount | null }) {
  if (count === null) return null;
  const { total, overdue } = count;
  return (
    <section
      aria-labelledby="hr-tasks-heading"
      className="border-rule flex flex-col gap-2.5 border-b px-7 py-6"
    >
      <h2
        id="hr-tasks-heading"
        className="flex items-center gap-2.5 text-xl leading-[normal] font-semibold"
      >
        <ClipboardList className="text-navy size-5 shrink-0" aria-hidden />
        Zadania kadr
      </h2>
      <p className="leading-6">
        {total === 0
          ? 'Kadry nie mają teraz zadań z terminów ocen.'
          : `${total} ${pluralPl(total, 'zadanie czeka', 'zadania czekają', 'zadań czeka')} w panelu kadr${
              overdue > 0 ? `, ${overdue} po terminie` : ''
            }.`}
      </p>
      <Link
        href={routes.hr}
        className="font-heading text-link self-start leading-[normal] font-medium underline"
      >
        Przejdź do panelu kadr
      </Link>
    </section>
  );
}
