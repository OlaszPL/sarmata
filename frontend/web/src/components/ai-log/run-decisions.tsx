import Link from 'next/link';
import type { AiFragmentDecision, AiRun } from '@sarmata/services';
import { DataTable, type DataTableColumn, Notice } from '@sarmata/ui';
import { formatDateTime, fragmentLabel } from '@/lib/ai-log/ai-log';
import { routes } from '@/lib/routes';

const decisionLabels: Record<AiFragmentDecision['decision'], string> = {
  accepted: 'Przyjęta',
  edited: 'Poprawiona',
  rejected: 'Odrzucona',
};

/** Decisions of one run, fragment by fragment, with who decided and when. */
export function RunDecisions({ run, people }: { run: AiRun; people: ReadonlyMap<string, string> }) {
  const columns: DataTableColumn<AiFragmentDecision>[] = [
    {
      key: 'fragment',
      header: 'Fragment',
      rowHeader: true,
      cell: (row) => fragmentLabel(row.fragment),
    },
    { key: 'decision', header: 'Decyzja', cell: (row) => decisionLabels[row.decision] },
    {
      key: 'by',
      header: 'Kto',
      cell: (row) => people.get(row.decidedBy) ?? 'Konto spoza akt',
    },
    { key: 'at', header: 'Kiedy', cell: (row) => formatDateTime(row.decidedAt) },
    {
      key: 'text',
      header: 'Tekst po poprawce',
      cell: (row) =>
        row.contentDeletedAt !== null ? (
          <span className="text-ink-muted">Treść usunięta po okresie przechowywania</span>
        ) : row.finalText !== null ? (
          <span className="max-w-[70ch]">{row.finalText}</span>
        ) : (
          <span className="text-ink-muted">Bez zmian</span>
        ),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      {run.failure ? (
        <Notice tone="error" title="Przebieg się nie udał">
          <p className="max-w-[70ch]">
            {run.failure.message
              ? `${run.failure.reason}: ${run.failure.message}`
              : run.failure.reason}
          </p>
        </Notice>
      ) : null}
      {run.evaluationId ? (
        <p>
          <Link
            href={routes.evaluation(run.evaluationId)}
            className="font-heading text-link font-medium underline"
          >
            Otwórz sprawę oceny
          </Link>
        </p>
      ) : null}
      {run.decisions.length > 0 ? (
        <DataTable
          caption="Decyzje o fragmentach przebiegu"
          columns={columns}
          rows={run.decisions}
          rowKey={(row) => row.fragment}
        />
      ) : (
        <p className="text-ink-muted max-w-[70ch]">
          Nikt jeszcze nie zdecydował o żadnym fragmencie.
        </p>
      )}
    </div>
  );
}
