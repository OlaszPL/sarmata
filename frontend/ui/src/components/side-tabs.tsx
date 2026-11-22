import type { ElementType } from 'react';
import { ArrowRight, SquareCheck } from 'lucide-react';
import { cn } from 'cn';

export interface SideTab {
  href: string;
  label: string;
  /** Second line, e.g. "Kryteria i termin" or "14 wpisów". */
  hint?: string | undefined;
  /** A finished part: a check icon and hidden text. */
  done?: boolean | undefined;
  current: boolean;
}

interface SideTabsProps {
  items: readonly SideTab[];
  /** Accessible name of the navigation. */
  label?: string | undefined;
  /** Link element, e.g. Next.js `Link`. A plain `<a>` by default. */
  linkAs?: ElementType | undefined;
  className?: string | undefined;
}

/** Vertical section tabs of a case. The current one is a navy block with an arrow and `aria-current`. */
export function SideTabs({
  items,
  label = 'Części sprawy',
  linkAs: LinkTag = 'a',
  className,
}: SideTabsProps) {
  return (
    <nav aria-label={label} className={className}>
      <ul className="flex flex-col">
        {items.map((item) => (
          <li key={item.href} className="border-rule border-b">
            <LinkTag
              href={item.href}
              aria-current={item.current ? 'page' : undefined}
              className={cn(
                'flex min-h-11 items-center gap-2.5 px-5 py-[0.8125rem] no-underline',
                item.current ? 'bg-navy text-white' : 'text-ink hover:bg-band bg-white',
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span
                  className={cn(
                    'font-heading text-[1.0625rem] leading-[normal]',
                    item.current
                      ? 'font-semibold'
                      : 'font-medium underline-offset-2 hover:underline',
                  )}
                >
                  {item.label}
                </span>
                {item.hint ? (
                  <span
                    className={cn(
                      'text-sm leading-[normal]',
                      item.current ? 'text-on-navy-muted' : 'text-ink-muted',
                    )}
                  >
                    {item.hint}
                  </span>
                ) : null}
              </span>
              {item.done ? (
                <>
                  <SquareCheck
                    className={cn(
                      'size-[1.125rem] shrink-0',
                      item.current ? 'text-white' : 'text-success',
                    )}
                    aria-hidden
                  />
                  <span className="sr-only">, ukończone</span>
                </>
              ) : null}
              {item.current ? <ArrowRight className="size-5 shrink-0" aria-hidden /> : null}
            </LinkTag>
          </li>
        ))}
      </ul>
    </nav>
  );
}
