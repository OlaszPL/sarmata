'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, CircleUser } from 'lucide-react';
import { signOut } from '@/lib/auth-actions';

interface AccountMenuProps {
  name: string;
  /** Second line: role and office. */
  details: string;
}

/**
 * The account cell of the header as a disclosure: the button shows who is signed in, the panel
 * holds the sign-out button. Escape, a click outside or focus moving away closes it.
 */
export function AccountMenu({ name, details }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const outside = (target: EventTarget | null) =>
      !(target instanceof Node && rootRef.current?.contains(target));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    const onPointerDown = (event: PointerEvent) => {
      if (outside(event.target)) setOpen(false);
    };
    const onFocusIn = (event: FocusEvent) => {
      if (outside(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="border-rule relative flex min-w-0 border-l">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
        }}
        className={`flex min-h-16 min-w-0 items-center gap-2.5 px-[1.125rem] text-left ${
          open ? 'bg-band' : 'hover:bg-band'
        }`}
      >
        <CircleUser className="size-6 shrink-0 md:hidden" aria-hidden />
        {/* Capped at the width of the mockup, a long office name is cut with an ellipsis. */}
        <span className="hidden max-w-[17.5rem] min-w-0 md:block">
          <span className="font-heading block truncate text-[0.9375rem] leading-[normal] font-semibold">
            {name}
          </span>
          <span className="text-ink-muted block truncate text-sm leading-[normal]">{details}</span>
        </span>
        <span className="sr-only"> Menu konta</span>
        <ChevronDown className={`size-4 shrink-0 ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="border-rule absolute top-full right-0 z-40 w-80 max-w-[calc(100vw-2rem)] border bg-white p-5"
      >
        <p className="font-heading font-semibold break-words">{name}</p>
        <p className="text-ink-muted mt-1 text-sm">{details}</p>
        <form action={signOut} className="mt-4">
          <button
            type="submit"
            className="bg-navy font-heading w-full px-4 py-2.5 font-semibold text-white"
          >
            Wyloguj się
          </button>
        </form>
      </div>
    </div>
  );
}
