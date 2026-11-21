import type { DscOckAnswer } from './reports';

const BOM = String.fromCodePoint(0xfeff);
const needsQuotes = /[;"\r\n]/;

const field = (value: string): string =>
  needsQuotes.test(value) ? `"${value.replaceAll('"', '""')}"` : value;

/**
 * CSV of the DSC-OCK answers for Excel: UTF-8 with a byte order mark, semicolon as the separator and CRLF
 * line ends. The separator deliberately departs from RFC 4180 (comma), because Polish Excel opens files with
 * a semicolon in separate columns. A `null` value is an empty cell.
 */
export function dscOckCsv(answers: readonly DscOckAnswer[]): string {
  const lines = [
    'pytanie;opis;wartosc',
    ...answers.map(
      (answer) =>
        `${String(answer.question)};${field(answer.label)};${answer.value === null ? '' : String(answer.value)}`,
    ),
  ];
  return BOM + lines.join('\r\n') + '\r\n';
}
