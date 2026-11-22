'use client';

import { useEffect } from 'react';

const PREFIX = 'Błąd: ';

/**
 * GOV.UK error pattern: while a form shows errors, the page title starts with "Błąd: ",
 * so screen reader users hear the failure when the page title is read. The prefix is
 * removed again when the errors are gone or the component unmounts.
 */
export function useErrorTitle(hasErrors: boolean): void {
  useEffect(() => {
    if (!hasErrors) return;
    const original = document.title.startsWith(PREFIX)
      ? document.title.slice(PREFIX.length)
      : document.title;
    document.title = `${PREFIX}${original}`;
    return () => {
      if (document.title.startsWith(PREFIX)) document.title = original;
    };
  }, [hasErrors]);
}
