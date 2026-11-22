import type { CalendarDate } from '@sarmata/services';
import { DataTable, type DataTableColumn, Notice, Tag } from '@sarmata/ui';
import { formatDate } from '@/lib/format';
import type { CaseResult } from '@/lib/regulations/labels';

const statusTags: Record<CaseResult['status'], { tone: 'done' | 'attention'; label: string }> = {
  passed: { tone: 'done', label: 'Zgodny' },
  failed: { tone: 'attention', label: 'Niezgodny' },
  error: { tone: 'attention', label: 'Błąd' },
};

const isDate = (value: unknown): value is CalendarDate =>
  typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);

/** A worked example result as short text: a deadline or a score, `null` for any other shape. */
function outcomeText(value: unknown, levelName: (code: string) => string): string | null {
  if (typeof value !== 'object' || value === null) return null;
  const record = value as Record<string, unknown>;
  if (record.kind === 'due' && isDate(record.due)) return `termin ${formatDate(record.due)}`;
  if (record.kind === 'suspended' && isDate(record.since)) {
    return `zawieszony od ${formatDate(record.since)}`;
  }
  if (
    typeof record.levelCode === 'string' &&
    (record.outcome === 'positive' || record.outcome === 'negative')
  ) {
    const outcome = record.outcome === 'positive' ? 'pozytywna' : 'negatywna';
    return `${levelName(record.levelCode)} ${outcome}`;
  }
  return null;
}

/** Results of the worked examples of a version, with the count of passing ones. */
export function CaseResults({
  cases,
  levels,
  acceptedFailingCases,
}: {
  cases: readonly CaseResult[];
  levels: readonly { code: string; name: string }[];
  acceptedFailingCases: readonly CaseResult[] | null;
}) {
  const levelName = (code: string) => levels.find((level) => level.code === code)?.name ?? code;
  const text = (row: CaseResult, value: unknown) =>
    outcomeText(value, levelName) ?? row.message ?? 'Brak wyniku';
  const columns: DataTableColumn<CaseResult>[] = [
    { key: 'title', header: 'Przypadek', rowHeader: true, cell: (row) => row.title },
    {
      key: 'status',
      header: 'Wynik',
      cell: (row) => {
        const tag = statusTags[row.status];
        return <Tag tone={tag.tone}>{tag.label}</Tag>;
      },
    },
    { key: 'expected', header: 'Oczekiwano', cell: (row) => text(row, row.expected) },
    { key: 'actual', header: 'Otrzymano', cell: (row) => text(row, row.actual) },
  ];
  const passed = cases.filter((item) => item.status === 'passed').length;

  return (
    <div className="grid gap-6">
      {acceptedFailingCases && acceptedFailingCases.length > 0 ? (
        <Notice tone="warning">
          <p className="max-w-[70ch]">
            Opublikowano mimo niezgodnych przypadków:{' '}
            {acceptedFailingCases.map((item) => item.title).join(', ')}.
          </p>
        </Notice>
      ) : null}
      {cases.length === 0 ? (
        <p className="max-w-[70ch]">Ta wersja nie ma przypadków testowych.</p>
      ) : (
        <>
          <p className="font-heading text-[1.0625rem] font-semibold">
            {passed} z {cases.length} zgodnych
          </p>
          <DataTable
            caption="Wyniki przypadków testowych"
            columns={columns}
            rows={cases}
            rowKey={(row) => row.caseId}
          />
        </>
      )}
    </div>
  );
}
