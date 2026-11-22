'use client';

import { useEffect } from 'react';

const PREFIX = 'Błąd: ';

/**
 * Adds the "Błąd: " prefix to the document title while a form shows errors and removes it when they
 * are gone, so screen reader users hear the failure as soon as the page title is read (GOV.UK).
 */
export function useErrorTitle(hasErrors: boolean): void {
  useEffect(() => {
    if (!hasErrors) return;
    if (!document.title.startsWith(PREFIX)) document.title = `${PREFIX}${document.title}`;
    return () => {
      if (document.title.startsWith(PREFIX)) document.title = document.title.slice(PREFIX.length);
    };
  }, [hasErrors]);
}
