import { AiMark, PixelLoader } from '@sarmata/ui';
import { type DashboardData } from '@/lib/dashboard/compose-dashboard';
import { AiDraftRefresh } from './ai-draft-refresh';

const PREVIEW_CHARS = 160;

/** Progress of sheet drafts the AI is writing. Shown only while at least one is queued or running. */
export function AiDraftPanel({ drafts }: { drafts: DashboardData['runningDrafts'] }) {
  if (drafts.length === 0) return null;

  return (
    <section aria-labelledby="ai-draft-heading" className="border-rule border-b px-6 py-8">
      <h2 id="ai-draft-heading" className="flex items-center gap-3 text-xl font-semibold">
        <AiMark className="size-4 shrink-0" />
        Szkic AI w przygotowaniu
      </h2>
      <ul className="mt-4 flex flex-col gap-4">
        {drafts.map((draft) => (
          <li key={draft.runId}>
            <PixelLoader
              label={`${draft.employeeName}: szkic oceny w przygotowaniu`}
              className="font-heading font-medium"
            />
            {draft.partialText ? (
              <p className="text-ink-muted mt-2 text-sm break-words">
                …{draft.partialText.slice(-PREVIEW_CHARS)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <AiDraftRefresh />
    </section>
  );
}
