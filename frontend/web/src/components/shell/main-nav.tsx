'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { NavItem } from '@/lib/nav';

function isActive(pathname: string, href: string): boolean {
  if (href === '/') return pathname === '/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Main navigation as header cells. The current section carries aria-current, a heavier weight and a
 * navy bar, so the state never rests on color alone.
 */
export function MainNav({ items }: { items: readonly NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Główna nawigacja">
      <ul className="flex h-full flex-wrap">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          return (
            <li key={item.href} className="border-rule flex border-r border-b xl:border-b-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`font-heading relative flex min-h-[3.9375rem] items-center px-[1.375rem] text-[1.0625rem] leading-[normal] whitespace-nowrap no-underline hover:underline ${
                  active ? 'text-navy font-semibold' : 'text-ink font-medium'
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
