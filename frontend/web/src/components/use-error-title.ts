'use client';

import { useEffect } from 'react';

const PREFIX = 'Błąd: ';

/** Forms on the page that currently show errors. The prefix stays while at least one does. */
let activeSources = 0;
let observer: MutationObserver | null = null;

const strip = (title: string) => (title.startsWith(PREFIX) ? title.slice(PREFIX.length) : title);

function apply() {
  if (!document.title.startsWith(PREFIX)) document.title = `${PREFIX}${document.title}`;
}

/**
 * GOV.UK error pattern: while a form shows errors, the page title starts with "Błąd: ",
 * so screen reader users hear the failure when the page title is read. Several forms on one
 * page share the prefix: it goes away only when none of them shows errors. Next.js streams
 * metadata and can write the title after this effect ran, so a MutationObserver puts the
 * prefix back whenever the title changes while errors are shown.
 */
export function useErrorTitle(hasErrors: boolean): void {
  useEffect(() => {
    if (!hasErrors) return;
    activeSources += 1;
    apply();
    if (!observer) {
      observer = new MutationObserver(apply);
      observer.observe(document.head, { childList: true, subtree: true, characterData: true });
    }
    return () => {
      activeSources -= 1;
      if (activeSources > 0) return;
      observer?.disconnect();
      observer = null;
      document.title = strip(document.title);
    };
  }, [hasErrors]);
}
