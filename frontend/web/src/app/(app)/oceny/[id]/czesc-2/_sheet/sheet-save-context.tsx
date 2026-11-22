'use client';

import { type ReactNode, type SubmitEvent, createContext, useContext, useTransition } from 'react';
import { LoaderCircle } from 'lucide-react';
import { Button, type ButtonSize, type ButtonVariant } from '@sarmata/ui';

/** Saves the pending change of the part II editor and resolves once it is stored or failed. */
export type FlushSheet = () => Promise<void>;

const SheetSaveContext = createContext<FlushSheet>(() => Promise.resolve());

/** Provided by the sheet editor around everything on part II that submits on its own. */
export const SheetSaveProvider = SheetSaveContext;

export function useFlushSheet(): FlushSheet {
  return useContext(SheetSaveContext);
}

/**
 * Submit handler for a form on part II next to the sheet (interview, AI start). It first stores a
 * change of the sheet that still waits for the autosave pause, then dispatches the action, so the
 * action never runs on an older sheet and the change is not lost when the page re-renders. Without
 * JavaScript the form posts through its `action` as before. Dispatching by hand also skips the
 * automatic form reset of React.
 */
export function useSubmitAfterFlush(
  action: (formData: FormData) => void,
  actionPending: boolean,
): { onSubmit: (event: SubmitEvent<HTMLFormElement>) => void; pending: boolean } {
  const flush = useFlushSheet();
  const [flushing, startTransition] = useTransition();
  const pending = flushing || actionPending;
  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      await flush();
      startTransition(() => {
        action(formData);
      });
    });
  };
  return { onSubmit, pending };
}

/**
 * Submit button for a form that dispatches its action by hand: the pending state comes from the
 * caller, since `useFormStatus` only sees actions that React runs itself. While sending it stays
 * focusable and announces the pending label, as `SubmitButton` of the UI package does.
 */
export function PendingSubmit({
  pending,
  pendingLabel,
  variant,
  size,
  className,
  children,
}: {
  pending: boolean;
  pendingLabel: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Button
      type="submit"
      variant={variant}
      size={size}
      aria-disabled={pending}
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
