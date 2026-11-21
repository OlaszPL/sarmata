'use client';

import { useEffect, useState } from 'react';
import { Contrast } from 'lucide-react';
import { CONTRAST_KEY, TEXT_SIZE_KEY } from '@/lib/a11y-settings';

function writeFlag(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked. The setting then lasts until the page is reloaded.
  }
}

/**
 * Header tools: larger text and high contrast, both remembered in the browser. The saved values are
 * applied by a head script before the first paint, this component reads them back from the page.
 */
export function A11yTools() {
  const [large, setLarge] = useState(false);
  const [high, setHigh] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    setLarge(root.dataset.textSize === 'large');
    setHigh(root.dataset.contrast === 'high');
  }, []);

  function toggleTextSize() {
    const next = !large;
    if (next) document.documentElement.dataset.textSize = 'large';
    else delete document.documentElement.dataset.textSize;
    writeFlag(TEXT_SIZE_KEY, next ? 'large' : null);
    setLarge(next);
  }

  function toggleContrast() {
    const next = !high;
    if (next) document.documentElement.dataset.contrast = 'high';
    else delete document.documentElement.dataset.contrast;
    writeFlag(CONTRAST_KEY, next ? 'high' : null);
    setHigh(next);
  }

  // Pressed is a full navy fill with white text: a strong cue that stays in high contrast mode.
  const base = 'flex min-h-16 items-center px-3';
  const state = (pressed: boolean) => (pressed ? 'bg-navy text-white' : 'text-ink hover:bg-band');

  return (
    <div className="border-rule flex border-l">
      <button
        type="button"
        aria-pressed={large}
        onClick={toggleTextSize}
        className={`${base} font-heading text-base font-bold ${state(large)}`}
      >
        A+<span className="sr-only"> Powiększ tekst</span>
      </button>
      <button
        type="button"
        aria-pressed={high}
        aria-label="Wysoki kontrast"
        onClick={toggleContrast}
        className={`${base} ${state(high)}`}
      >
        <Contrast className="size-5" aria-hidden />
      </button>
    </div>
  );
}
