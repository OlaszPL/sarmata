'use client';

import Link from 'next/link';
import { useSelectedLayoutSegment } from 'next/navigation';
import { SideTabs } from '@sarmata/ui';

export interface CaseTab {
  /** Route segment under `/oceny/[id]`, null for the overview. */
  segment: string | null;
  /** Further segments that belong to this tab, e.g. `sprawdz` to part II. */
  alsoFor?: readonly string[];
  href: string;
  label: string;
  hint?: string;
  done?: boolean;
}

/** The side tabs of a case. Client side only to read the current segment for `aria-current`. */
export function CaseTabs({ tabs, className }: { tabs: readonly CaseTab[]; className?: string }) {
  const segment = useSelectedLayoutSegment();
  return (
    <SideTabs
      linkAs={Link}
      label="Części sprawy"
      className={className}
      items={tabs.map((tab) => ({
        href: tab.href,
        label: tab.label,
        ...(tab.hint === undefined ? {} : { hint: tab.hint }),
        ...(tab.done === undefined ? {} : { done: tab.done }),
        current:
          tab.segment === segment || (segment !== null && Boolean(tab.alsoFor?.includes(segment))),
      }))}
    />
  );
}
