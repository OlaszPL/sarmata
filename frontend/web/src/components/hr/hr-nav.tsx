'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { routes } from '@/lib/routes';

const items = [
  { href: routes.hr, label: 'Zadania' },
  { href: `${routes.hr}/harmonogram`, label: 'Harmonogram' },
  { href: `${routes.hr}/statystyki`, label: 'Statystyki' },
  { href: `${routes.hr}/rejestr`, label: 'Rejestr' },
  { href: `${routes.hr}/import`, label: 'Import pracowników' },
  { href: `${routes.hr}/struktura`, label: 'Struktura' },
];

/** Section links of the HR panel. The current one is a navy block with `aria-current`. */
export function HrNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Panel kadr" className="border-rule border-b">
      <ul className="flex flex-wrap">
        {items.map((item) => {
          const current = pathname === item.href;
          return (
            <li key={item.href} className="border-rule border-r border-b-0">
              <Link
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`font-heading flex min-h-11 items-center px-5 py-2.5 text-[1.0625rem] leading-[normal] no-underline ${
                  current
                    ? 'bg-navy font-semibold text-white'
                    : 'text-ink hover:bg-band bg-white font-medium underline-offset-2 hover:underline'
                }`}
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
