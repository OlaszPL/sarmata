'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_MS = 5000;
/** Polling stops after this long, a reload starts it again. */
const MAX_POLL_MS = 10 * 60 * 1000;

/** Re-renders the server page every few seconds while an AI draft is being written. */
export function AiDraftRefresh() {
  const router = useRouter();

  useEffect(() => {
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > MAX_POLL_MS) {
        clearInterval(timer);
        return;
      }
      if (document.visibilityState === 'hidden') return;
      router.refresh();
    }, REFRESH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
