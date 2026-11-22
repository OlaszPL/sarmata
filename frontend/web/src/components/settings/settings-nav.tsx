import type { ReactNode } from 'react';
import Link from 'next/link';
import { PageHero } from '@sarmata/ui';
import { routes } from '@/lib/routes';

export type SettingsSection = 'office' | 'accounts' | 'rules';

const items: readonly { section: SettingsSection; label: string; href: string }[] = [
  { section: 'office', label: 'Ustawienia urzędu', href: routes.settings },
  { section: 'accounts', label: 'Konta', href: routes.settingsAccounts },
  { section: 'rules', label: 'Wersje przepisów', href: routes.settingsRules },
];

/** Horizontal links between the three settings screens. */
export function SettingsNav({ current }: { current: SettingsSection }) {
  return (
    <nav aria-label="Ustawienia">
      <ul className="border-rule flex w-fit flex-wrap border">
        {items.map((item) => {
          const isCurrent = item.section === current;
          return (
            <li key={item.section} className="border-rule border-l first:border-l-0">
              <Link
                href={item.href}
                aria-current={isCurrent ? 'page' : undefined}
                className={
                  isCurrent
                    ? 'bg-navy font-heading flex min-h-11 items-center px-5 leading-[normal] font-semibold text-white no-underline'
                    : 'font-heading text-link flex min-h-11 items-center px-5 leading-[normal] font-medium underline'
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Hero of a settings screen with the section switch below it. Crumbs default to Ustawienia and the
 * title (the title alone on the office settings), `crumbs` replaces them, for example on a detail page.
 */
export function SettingsHero({
  title,
  current,
  meta,
  crumbs,
}: {
  title: string;
  current: SettingsSection;
  meta?: ReactNode;
  crumbs?: readonly { href?: string; label: string }[];
}) {
  const defaultCrumbs =
    current === 'office'
      ? [{ label: title }]
      : [{ href: routes.settings, label: 'Ustawienia' }, { label: title }];
  return (
    <>
      <PageHero linkAs={Link} crumbs={crumbs ?? defaultCrumbs} title={title} meta={meta} />
      <div className="border-rule border-b px-6 py-4 sm:px-10">
        <SettingsNav current={current} />
      </div>
    </>
  );
}
