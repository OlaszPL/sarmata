'use client';

import type { MouseEvent, ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { LoaderCircle } from 'lucide-react';
import { Button, type ButtonSize, type ButtonVariant } from '#components/button';

interface SubmitButtonProps {
  children: ReactNode;
  /** Label shown while the form is being sent, e.g. "Trwa zapisywanie". */
  pendingLabel: string;
  variant?: ButtonVariant | undefined;
  size?: ButtonSize | undefined;
  /** Submits under this name, e.g. to tell "Zapisz" from "Zatwierdź" in one form. */
  name?: string | undefined;
  value?: string | undefined;
  className?: string | undefined;
}

/**
 * Submit button of a form. While sending it stays focusable and announces the pending label
 * instead of becoming disabled (UX recommendation 11 in FINDINGS).
 */
export function SubmitButton({
  children,
  pendingLabel,
  variant = 'primary',
  size = 'md',
  name,
  value,
  className,
}: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const ignoreWhilePending = (event: MouseEvent<HTMLButtonElement>) => {
    if (pending) event.preventDefault();
  };

  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      name={name}
      value={value}
      aria-disabled={pending}
      onClick={ignoreWhilePending}
      className={className}
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
