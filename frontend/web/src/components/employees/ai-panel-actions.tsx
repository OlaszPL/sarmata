'use client';

import { useActionState } from 'react';
import { Notice, SubmitButton } from '@sarmata/ui';
import {
  type AiAnalysisKind,
  type PanelActionState,
  rejectSignal,
  startAiAnalysis,
} from '@/app/(app)/pracownicy/[id]/actions';

const initialState: PanelActionState = {};

function ActionError({ state }: { state: PanelActionState }) {
  if (!state.error) return null;
  return (
    <Notice tone="error" role="alert">
      <p>{state.error}</p>
    </Notice>
  );
}

interface AiStartFormProps {
  employeeId: string;
  kind: AiAnalysisKind;
  label: string;
}

/**
 * One button that starts an AI analysis of this person. A refusal shows as a message below it. It is
 * secondary, the card keeps one main button.
 */
export function AiStartForm({ employeeId, kind, label }: AiStartFormProps) {
  const [state, formAction] = useActionState(
    startAiAnalysis.bind(null, employeeId, kind),
    initialState,
  );
  return (
    <form action={formAction} className="grid justify-items-start gap-3">
      <SubmitButton pendingLabel="Uruchamiam analizę" variant="secondary">
        {label}
      </SubmitButton>
      <ActionError state={state} />
    </form>
  );
}

interface RejectSignalFormProps {
  employeeId: string;
  runId: string;
  signal: string;
}

/**
 * "Nie zgadzam się z sygnałem": the decision about one signal, logged for the AI usage log. The
 * button turns into the tag "Odrzucono", so the focus moves to the heading of the signal.
 */
export function RejectSignalForm({ employeeId, runId, signal }: RejectSignalFormProps) {
  const [state, formAction] = useActionState(
    async (previous: PanelActionState, formData: FormData) => {
      const result = await rejectSignal(previous, formData);
      if (!result.error) document.getElementById(`signal-${signal}`)?.focus();
      return result;
    },
    initialState,
  );
  return (
    <form action={formAction} className="grid justify-items-start gap-2">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="runId" value={runId} />
      <input type="hidden" name="signal" value={signal} />
      <SubmitButton pendingLabel="Zapisuję decyzję" variant="link" className="text-[0.9375rem]">
        Nie zgadzam się z sygnałem
      </SubmitButton>
      <ActionError state={state} />
    </form>
  );
}
