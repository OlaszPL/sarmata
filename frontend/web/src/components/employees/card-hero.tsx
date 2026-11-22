import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageHero } from '@sarmata/ui';
import { type CardData } from '@/lib/employees/load-card';
import { employmentBasisLabels, serviceStatusLabels } from '@/lib/employees/labels';
import { formatDate, romanNumeral } from '@/lib/format';
import { routes } from '@/lib/routes';

/** The white block on navy from the mockup: the one main action of the card. */
const mainActionClasses =
  'font-heading text-navy inline-flex h-11 items-center gap-2 bg-white px-4 text-base leading-[normal] font-semibold whitespace-nowrap hover:underline [&_svg]:size-[1.125rem]';
const secondaryActionClasses =
  'font-heading inline-flex h-11 items-center border border-white px-4 text-base leading-[normal] font-medium whitespace-nowrap text-white hover:underline';

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "Specjalista, Wydział Merytoryczny. Urzędnik służby cywilnej, stopień IV, mianowanie. ..." */
function metaLine({ employee, supervisorName }: CardData): string {
  const place = [employee.positionTitle, employee.orgUnit].filter(Boolean).join(', ');
  const status = [
    serviceStatusLabels[employee.serviceStatus],
    employee.serviceStatus === 'civil_servant' && employee.grade !== null
      ? `stopień ${romanNumeral(employee.grade)}`
      : null,
    lowerFirst(employmentBasisLabels[employee.employmentBasis]),
  ]
    .filter(Boolean)
    .join(', ');
  return [
    place ? `${place}.` : null,
    `${status}.`,
    employee.employmentStart ? `W urzędzie od ${formatDate(employee.employmentStart)}.` : null,
    employee.employmentEndedOn
      ? `Zatrudnienie ustało ${formatDate(employee.employmentEndedOn)}.`
      : null,
    supervisorName ? `Osoba przełożona: ${supervisorName}.` : null,
  ]
    .filter(Boolean)
    .join(' ');
}

/** Navy header of the employee card: crumbs, name, position, actions and the key numbers. */
export function CardHero({ data }: { data: CardData }) {
  const { employee, account, notes, currentEvaluationId, history } = data;
  const name = `${employee.firstName} ${employee.lastName}`;
  const canStart =
    (account.role === 'evaluator' || account.role === 'hr') && employee.employmentEndedOn === null;
  const canAddNote = notes !== null && account.role !== 'admin';

  const mainAction = currentEvaluationId ? (
    <Link href={routes.evaluation(currentEvaluationId)} className={mainActionClasses}>
      Otwórz bieżącą ocenę
      <ArrowRight aria-hidden />
    </Link>
  ) : canStart ? (
    <Link
      href={`${routes.newEvaluation}?${new URLSearchParams({ pracownik: employee.id }).toString()}`}
      className={mainActionClasses}
    >
      Rozpocznij ocenę
      <ArrowRight aria-hidden />
    </Link>
  ) : null;

  const actions =
    mainAction || canAddNote ? (
      <>
        {mainAction}
        {canAddNote ? (
          <Link
            href={`${routes.employee(employee.id)}?notatka=nowa#notatka-formularz`}
            className={secondaryActionClasses}
          >
            Dodaj notatkę
          </Link>
        ) : null}
      </>
    ) : undefined;

  return (
    <PageHero
      linkAs={Link}
      crumbs={[{ href: routes.employees, label: 'Moi pracownicy' }]}
      title={name}
      meta={metaLine(data)}
      actions={actions}
      stats={history.stats}
    />
  );
}
