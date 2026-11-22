import { AiMark, PixelLoader } from '@sarmata/ui';
import { type DashboardData } from '@/lib/dashboard/compose-dashboard';
import { PollingRefresh } from '@/components/polling-refresh';

const PREVIEW_CHARS = 160;

/** The end of the text the model writes, cut at a word boundary with no mark (no ellipsis). */
function previewTail(text: string): string {
  if (text.length <= PREVIEW_CHARS) return text;
  const tail = text.slice(-PREVIEW_CHARS);
  const space = tail.indexOf(' ');
  return space === -1 ? tail : tail.slice(space + 1);
}

/** Progress of sheet drafts the AI is writing. Shown only while at least one is queued or running. */
export function AiDraftPanel({ drafts }: { drafts: DashboardData['runningDrafts'] }) {
  if (drafts.length === 0) return null;

  return (
    <section
      aria-labelledby="ai-draft-heading"
      className="border-rule flex flex-col gap-3 border-b px-7 py-6"
    >
      <h2
        id="ai-draft-heading"
        className="flex items-center gap-2.5 text-xl leading-[normal] font-semibold"
      >
        <AiMark className="size-4 shrink-0" />
        Szkic AI w przygotowaniu
      </h2>
      <ul className="flex flex-col gap-4">
        {drafts.map((draft) => (
          <li key={draft.runId}>
            <PixelLoader
              label={`${draft.employeeName}: szkic oceny w przygotowaniu`}
              className="font-heading leading-[normal] font-semibold"
            />
            {draft.partialText ? (
              <p className="text-ink-muted mt-0.5 text-[0.9375rem] leading-[normal] break-words">
                {previewTail(draft.partialText)}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <PollingRefresh active />
    </section>
  );
}
