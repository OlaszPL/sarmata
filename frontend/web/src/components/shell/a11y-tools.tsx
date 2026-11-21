'use client';

import { useEffect, useState } from 'react';
import { Contrast } from 'lucide-react';

const TEXT_SIZE_KEY = 'sarmata.textSize';
const CONTRAST_KEY = 'sarmata.contrast';

function readFlag(key: string, on: string): boolean {
  try {
    return window.localStorage.getItem(key) === on;
  } catch {
    return false;
  }
}

function writeFlag(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // Storage can be blocked. The setting then lasts until the page is reloaded.
  }
}

/** Header tools: larger text and high contrast, both remembered in the browser. */
export function A11yTools() {
  const [large, setLarge] = useState(false);
  const [high, setHigh] = useState(false);

  useEffect(() => {
    const savedLarge = readFlag(TEXT_SIZE_KEY, 'large');
    const savedHigh = readFlag(CONTRAST_KEY, 'high');
    if (savedLarge) document.documentElement.dataset.textSize = 'large';
    if (savedHigh) document.documentElement.dataset.contrast = 'high';
    setLarge(savedLarge);
    setHigh(savedHigh);
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

  const base = 'flex min-h-16 items-center px-4';
  const on = 'bg-band';

  return (
    <div className="border-rule flex border-l">
      <button
        type="button"
        aria-pressed={large}
        aria-label="Powiększ tekst"
        onClick={toggleTextSize}
        className={`${base} font-heading text-base font-bold ${large ? on : ''}`}
      >
        <span aria-hidden>A+</span>
      </button>
      <button
        type="button"
        aria-pressed={high}
        aria-label="Wysoki kontrast"
        onClick={toggleContrast}
        className={`${base} ${high ? on : ''}`}
      >
        <Contrast className="size-5" aria-hidden />
      </button>
    </div>
  );
}
