import Link from 'next/link';
import { Award } from 'lucide-react';
import { type DashboardData } from '@/lib/dashboard/compose-dashboard';
import { routes } from '@/lib/routes';

/**
 * A person who could use a word of appreciation, suggested by the AI from the notes. Always last in
 * the side band, so it draws no bottom line.
 */
export function AppreciationPanel({
  appreciation,
}: {
  appreciation: DashboardData['appreciation'];
}) {
  if (!appreciation) return null;

  return (
    <section aria-labelledby="appreciation-heading" className="flex flex-col gap-2.5 px-7 py-6">
      <h2
        id="appreciation-heading"
        className="flex items-center gap-2.5 text-xl leading-[normal] font-semibold"
      >
        <Award className="text-navy size-5 shrink-0" aria-hidden />
        Moment na docenienie
      </h2>
      <p className="leading-6">
        {appreciation.employeeName}. {appreciation.reason}
      </p>
      <Link
        href={routes.employee(appreciation.employeeId)}
        className="font-heading text-link self-start leading-[normal] font-medium underline"
      >
        Napisz informację zwrotną
      </Link>
    </section>
  );
}
