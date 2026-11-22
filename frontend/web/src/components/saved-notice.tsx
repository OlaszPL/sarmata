'use client';

import { type ReactNode, useEffect, useRef } from 'react';
import { Notice } from '@sarmata/ui';

/**
 * Success notice after a save that removed the form (a redirect, or the case left the list). It takes
 * the focus on mount, so focus does not fall to the page body and screen readers read it.
 */
export function SavedNotice({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  return (
    <div ref={ref} tabIndex={-1} className="outline-none">
      <Notice tone="success" role="status">
        {children}
      </Notice>
    </div>
  );
}
