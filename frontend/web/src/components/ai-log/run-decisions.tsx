import Link from 'next/link';
import { DataTable, type DataTableColumn, Notice, SummaryList, type SummaryRow } from '@sarmata/ui';
import {
  failureReasonText,
  formatDateTime,
  fragmentLabel,
  type LogDecision,
  type LogRunDetail,
} from '@/lib/ai-log/ai-log';
import { routes } from '@/lib/routes';

const decisionLabels: Record<LogDecision['decision'], string> = {
  accepted: 'Przyjęta',
  edited: 'Poprawiona',
  rejected: 'Odrzucona',
};

const numberFormat = new Intl.NumberFormat('pl-PL');

function summaryRows(run: LogRunDetail): SummaryRow[] {
  const rows: SummaryRow[] = [];
  if (run.model !== null) rows.push({ key: 'Model', value: run.model });
  if (run.promptVersion !== null) rows.push({ key: 'Wersja promptu', value: run.promptVersion });
  if (run.outputTokens !== null) {
    rows.push({ key: 'Tokeny odpowiedzi', value: numberFormat.format(run.outputTokens) });
  }
  if (run.failureReason !== null) {
    rows.push({ key: 'Powód niepowodzenia', value: failureReasonText(run.failureReason) });
  }
  if (run.contentDeletedAt !== null) {
    rows.push({ key: 'Treść usunięta', value: formatDateTime(run.contentDeletedAt).slice(0, 10) });
  }
  return rows;
}

/**
 * Decisions of one run, fragment by fragment, with who decided and when. `withContent` is false for
 * the admin log, which has no final texts.
 */
export function RunDecisions({
  run,
  people,
  criterionName,
  withContent,
}: {
  run: LogRunDetail;
  people: ReadonlyMap<string, string>;
  criterionName?: ((id: string) => string) | undefined;
  withContent: boolean;
}) {
  const textColumn: DataTableColumn<LogDecision> = {
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
  };
  const columns: DataTableColumn<LogDecision>[] = [
    {
      key: 'fragment',
      header: 'Fragment',
      rowHeader: true,
      cell: (row) => fragmentLabel(row.fragment, criterionName),
    },
    { key: 'decision', header: 'Decyzja', cell: (row) => decisionLabels[row.decision] },
    {
      key: 'by',
      header: 'Kto',
      cell: (row) => people.get(row.decidedBy) ?? 'Konto spoza akt',
    },
    { key: 'at', header: 'Kiedy', cell: (row) => formatDateTime(row.decidedAt) },
    ...(withContent ? [textColumn] : []),
  ];

  const summary = summaryRows(run);

  return (
    <div className="flex flex-col gap-4">
      {run.failureMessage ? (
        <Notice tone="error" title="Przebieg się nie udał">
          <p className="max-w-[70ch]">{run.failureMessage}</p>
        </Notice>
      ) : null}
      {summary.length > 0 ? <SummaryList rows={summary} /> : null}
      {withContent ? null : (
        <p className="max-w-[70ch]">
          Dziennik administratora pokazuje decyzje bez treści sugestii i poprawek.
        </p>
      )}
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
