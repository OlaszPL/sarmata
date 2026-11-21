'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/** Main navigation as header cells. The current section carries aria-current and a navy bar. */
export function MainNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Główna nawigacja">
      <ul className="flex h-full">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="border-rule flex border-r">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`font-heading relative flex min-h-16 items-center px-7 text-[1.0625rem] font-medium ${
                  active ? 'text-navy underline' : 'text-ink no-underline hover:underline'
                }`}
              >
                {item.label}
                {active ? (
                  <span className="bg-navy absolute inset-x-0 bottom-0 h-1" aria-hidden />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
