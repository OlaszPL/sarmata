// Generates development/training-catalog.json from docs/sources/szkolenia-katalog/katalog.csv.
// Run with `pnpm --filter @sarmata/regulations import-training-catalog` (Node 24, no dependencies).
// The JSON is committed, so the service never reads the CSV. Validation lives in training-catalog.test.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const source = join(root, 'docs', 'sources', 'szkolenia-katalog', 'katalog.csv');
const target = join(root, 'backend', 'regulations', 'development', 'training-catalog.json');

const CRITERION_BY_CODE: Record<string, string> = {
  KOM: 'communication',
  WIE: 'knowledge-use',
  ZL: 'people-management',
  ANA: 'analytical-thinking',
  RZE: 'reliability',
  ORG: 'work-organization',
  KLI: 'customer-orientation',
  KRY: 'crisis-management',
  WSP: 'cooperation',
  DEC: 'decision-making',
  ZS: 'strategic-management',
  WYS: 'public-speaking',
  KRE: 'creativity',
  NEG: 'negotiation',
};

const CRITERION_BY_NAME: Record<string, string> = {
  'zarządzanie ludźmi': 'people-management',
  komunikacja: 'communication',
  'wykorzystywanie wiedzy i doskonalenie zawodowe': 'knowledge-use',
  'myślenie analityczne': 'analytical-thinking',
  rzetelność: 'reliability',
  'organizacja pracy i orientacja na osiąganie celów': 'work-organization',
  'orientacja na klienta/interesanta': 'customer-orientation',
  'radzenie sobie w sytuacjach kryzysowych': 'crisis-management',
  'wystąpienia publiczne': 'public-speaking',
  współpraca: 'cooperation',
  'zarządzanie strategiczne': 'strategic-management',
  kreatywność: 'creativity',
  'podejmowanie decyzji i odpowiedzialność': 'decision-making',
  negocjowanie: 'negotiation',
};

const CHANNEL_BY_SOURCE: Record<string, string> = {
  'System e-learningowy SC': 'sc-elearning',
  'Program dzielenia się wiedzą - webinar': 'pdw-webinar',
  'PDW - rejestr trenerów SC': 'sc-trainers',
  'materiały dla trenerów wewnętrznych': 'sc-trainers',
  'szkolenie centralne SSC (realizacja KSAP)': 'central-training',
  'platforma rządowa': 'government-platform',
  materiały: 'government-platform',
  'MC - dostępność': 'government-platform',
  'MC - cyberbezpieczeństwo': 'government-platform',
  'MC - dane': 'government-platform',
  'MC - AI': 'government-platform',
  'MC - e-usługi': 'government-platform',
  mentoring: 'mentoring',
  'Navoica (MOOC)': 'mooc',
  MOOC: 'mooc',
  'Akademia PARP (e-learning)': 'mooc',
};

/** Parses RFC 4180 CSV: quoted fields may hold commas, doubled quotes and line breaks. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text.charAt(i);
    if (quoted) {
      if (char === '"' && text.charAt(i + 1) === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text.charAt(i + 1) === '\n') i += 1;
      row.push(field);
      field = '';
      if (row.some((cell) => cell !== '')) rows.push(row);
      row = [];
    } else {
      field += char;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function status(raw: string): string {
  if (raw.includes('cykliczne') || raw.includes('powtarzane')) return 'recurring';
  if (raw.includes('zrealizowane')) return 'finished';
  if (raw.includes('na zapytanie')) return 'on-request';
  if (
    raw.includes('do potwierdzenia') ||
    raw.includes('niezweryfikowane') ||
    raw.includes('nabór')
  ) {
    return 'unconfirmed';
  }
  return 'available';
}

function audience(raw: string): string {
  if (/wszyscy|wszystkie|każdy/i.test(raw)) return 'all';
  if (/kierown|dyrektor|dyrektork|menedżer|lider/i.test(raw)) return 'managers';
  if (/kadrow|trener|HR/.test(raw)) return 'specialists';
  return 'all';
}

function required(value: string | undefined, what: string): string {
  if (value === undefined) throw new Error(`Missing ${what}`);
  return value;
}

const [header, ...records] = parseCsv(readFileSync(source, 'utf8'));
if (!header) throw new Error('Empty catalog');

const items = records.map((record) => {
  const cell = (name: string): string => (record[header.indexOf(name)] ?? '').trim();
  const id = cell('id');
  const channel =
    CHANNEL_BY_SOURCE[cell('rodzaj_zrodla')] ??
    (cell('rodzaj_zrodla').startsWith('KSAP') ? 'ksap' : undefined);
  const mainName = cell('kryterium_glowne');
  return {
    id,
    title: cell('nazwa'),
    organizer: cell('organizator'),
    channel: required(channel, `channel of ${id} (${cell('rodzaj_zrodla')})`),
    form: cell('forma'),
    topics: cell('temat'),
    criteria: cell('kryteria_kody')
      .split(/\s+/)
      .filter((code) => code !== '')
      .map((code) => required(CRITERION_BY_CODE[code], `criterion code ${code} of ${id}`)),
    mainCriterion: required(CRITERION_BY_NAME[mainName], `main criterion "${mainName}" of ${id}`),
    audience: audience(cell('odbiorcy')),
    url: cell('url') === '' ? null : cell('url'),
    dates: cell('data') === '' ? null : cell('data'),
    cost: cell('koszt'),
    free: cell('koszt') === 'bezpłatne',
    status: status(cell('status')),
    priorityYears: [...cell('tagi').matchAll(/priorytet-(\d{4})/g)].map((match) =>
      Number(match[1]),
    ),
  };
});

writeFileSync(target, `${JSON.stringify(items, null, 2)}\n`);
console.log(`Wrote ${items.length} items to ${target}`);
