'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const REFRESH_MS = 5000;

/** Re-renders the server page every few seconds while an AI draft is being written. */
export function AiDraftRefresh() {
  const router = useRouter();

  useEffect(() => {
    const timer = setInterval(() => {
      router.refresh();
    }, REFRESH_MS);
    return () => {
      clearInterval(timer);
    };
  }, [router]);

  return null;
}
