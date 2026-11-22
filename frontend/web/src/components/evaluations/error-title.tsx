'use client';

import { useEffect } from 'react';

const PREFIX = 'Błąd: ';

/**
 * Prefixes the page title with "Błąd: " while a form shows errors (GOV.UK pattern), so a screen
 * reader announces the failure with the title. Removes the prefix once the errors are gone.
 */
export function ErrorTitle({ active }: { active: boolean }) {
  useEffect(() => {
    if (!active) return;
    if (!document.title.startsWith(PREFIX)) document.title = `${PREFIX}${document.title}`;
    return () => {
      if (document.title.startsWith(PREFIX)) document.title = document.title.slice(PREFIX.length);
    };
  }, [active]);
  return null;
}
