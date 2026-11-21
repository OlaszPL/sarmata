'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface PollingRefreshProps {
  /** Polls only while true, e.g. while an AI run is queued or running. */
  active: boolean;
  /** Time between refreshes. */
  intervalMs?: number;
  /** Polling stops after this long, a reload starts it again. */
  maxMs?: number;
  /** Shown (and announced) once polling stopped on the time limit. Nothing is shown without it. */
  timeoutMessage?: string;
}

const DEFAULT_INTERVAL_MS = 5000;
const DEFAULT_MAX_MS = 10 * 60 * 1000;

/**
 * Re-renders the server page every few seconds while `active`, skipping hidden tabs. Used for AI
 * progress: the server reads `ai.get` again on each refresh.
 */
export function PollingRefresh({
  active,
  intervalMs = DEFAULT_INTERVAL_MS,
  maxMs = DEFAULT_MAX_MS,
  timeoutMessage,
}: PollingRefreshProps) {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    if (!active) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      if (Date.now() - startedAt > maxMs) {
        clearInterval(timer);
        setTimedOut(true);
        return;
      }
      if (document.visibilityState === 'hidden') return;
      router.refresh();
    }, intervalMs);
    return () => {
      clearInterval(timer);
    };
  }, [active, intervalMs, maxMs, router]);

  if (!active || !timedOut || !timeoutMessage) return null;
  return (
    <p role="status" className="text-ink-muted text-[0.9375rem] leading-[1.45]">
      {timeoutMessage}
    </p>
  );
}
