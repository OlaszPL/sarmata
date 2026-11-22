'use client';

import { useEffect } from 'react';

const PREFIX = 'Błąd: ';

/**
 * GOV.UK error pattern: while a form shows errors, the page title starts with "Błąd: ",
 * so screen reader users hear the failure when the page title is read. Next.js streams
 * metadata and can write the title after this effect ran, so a MutationObserver puts the
 * prefix back whenever the title changes. The prefix goes away with the errors or on unmount.
 */
export function useErrorTitle(hasErrors: boolean): void {
  useEffect(() => {
    if (!hasErrors) return;
    const strip = (title: string) =>
      title.startsWith(PREFIX) ? title.slice(PREFIX.length) : title;
    const apply = () => {
      if (!document.title.startsWith(PREFIX)) document.title = `${PREFIX}${document.title}`;
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    return () => {
      observer.disconnect();
      document.title = strip(document.title);
    };
  }, [hasErrors]);
}
