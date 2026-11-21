'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { Button } from '#shadcn/ui/button';

interface SubmitButtonProps {
  children: ReactNode;
  /** Label shown while the form is being sent, e.g. "Logowanie…". */
  pendingLabel: string;
  className?: string;
}

/**
 * Primary submit button of a form. While sending it stays focusable and announces the pending
 * label instead of becoming disabled (UX recommendation 11 in FINDINGS).
 */
export function SubmitButton({ children, pendingLabel, className }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const ignoreWhilePending = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) event.preventDefault();
  };

  return (
    <Button
      type="submit"
      aria-disabled={pending}
      onClick={ignoreWhilePending}
      className={['font-heading h-11 px-5 text-base', className].filter(Boolean).join(' ')}
    >
      {pending ? (
        <>
          <LoaderCircle className="animate-spin" aria-hidden />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
