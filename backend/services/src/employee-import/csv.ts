export type CsvDelimiter = ';' | ',';

export interface ParsedCsv {
  readonly delimiter: CsvDelimiter;
  readonly headers: string[];
  /** Data rows without blank lines. Every row has as many cells as there are headers. */
  readonly rows: string[][];
}

/** Picks the delimiter that occurs more often in the header line outside quotes. `;` wins a tie (Polish Excel). */
function detectDelimiter(text: string): CsvDelimiter {
  let semicolons = 0;
  let commas = 0;
  let quoted = false;
  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char === ';') semicolons += 1;
    else if (!quoted && char === ',') commas += 1;
  }
  return commas > semicolons ? ',' : ';';
}

/** Parses UTF-8 CSV (RFC 4180 quoting, `;` or `,`, optional BOM). Throws on an empty file or an unclosed quote. */
export function parseCsv(input: string): ParsedCsv {
  const text = input.startsWith('﻿') ? input.slice(1) : input;
  const delimiter = detectDelimiter(text);
  const table: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  const endCell = () => {
    row.push(cell);
    cell = '';
  };
  const endRow = () => {
    endCell();
    if (row.some((value) => value.trim() !== '')) table.push(row);
    row = [];
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text.charAt(index);
    if (quoted) {
      if (char === '"') {
        if (text.charAt(index + 1) === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += char;
      }
    } else if (char === '"' && cell === '') {
      quoted = true;
    } else if (char === delimiter) {
      endCell();
    } else if (char === '\n') {
      endRow();
    } else if (char === '\r') {
      if (text.charAt(index + 1) === '\n') index += 1;
      endRow();
    } else {
      cell += char;
    }
  }
  if (quoted) throw new Error('Unclosed quote in the CSV file');
  if (cell !== '' || row.length > 0) endRow();

  const [headerRow, ...rows] = table;
  if (headerRow === undefined) throw new Error('The CSV file is empty');
  const headers = headerRow.map((header) => header.trim());
  return {
    delimiter,
    headers,
    rows: rows.map((values) => headers.map((_, column) => (values[column] ?? '').trim())),
  };
}
