'use client';

import { type ReactNode, useId } from 'react';

/**
 * A titled group of fields inside a long settings form. The H2 and the fields share one left edge,
 * a 1 px rule under the title separates the group like the page sections do.
 */
export function FormGroup({ title, children }: { title: string; children: ReactNode }) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="grid grid-cols-1 gap-6">
      <h2
        id={headingId}
        className="font-heading text-ink border-rule border-b pb-3 text-[1.875rem] leading-[normal] font-semibold tracking-[-0.0133em]"
      >
        {title}
      </h2>
      {children}
    </section>
  );
}
