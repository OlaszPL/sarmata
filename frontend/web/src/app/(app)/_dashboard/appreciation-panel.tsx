import Link from 'next/link';
import { Award } from 'lucide-react';
import { type DashboardData } from '@/lib/dashboard/compose-dashboard';
import { routes } from '@/lib/routes';

/** A person who could use a word of appreciation, suggested by the AI from the notes. */
export function AppreciationPanel({
  appreciation,
}: {
  appreciation: DashboardData['appreciation'];
}) {
  if (!appreciation) return null;

  return (
    <section aria-labelledby="appreciation-heading" className="border-rule border-b px-6 py-8">
      <h2 id="appreciation-heading" className="flex items-center gap-3 text-xl font-semibold">
        <Award className="text-navy size-5 shrink-0" aria-hidden />
        Moment na docenienie
      </h2>
      <p className="font-heading mt-3 text-lg font-semibold">{appreciation.employeeName}</p>
      <p className="mt-1">{appreciation.reason}</p>
      <Link
        href={routes.employee(appreciation.employeeId)}
        className="font-heading text-link mt-3 inline-block font-semibold underline"
      >
        Napisz informację zwrotną
      </Link>
    </section>
  );
}
