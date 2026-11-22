// Client components import this file: only types from the services, never a value import.
import type { DeadlineSlot, RegulationDocument, RegulationIssue } from '@sarmata/services';
import type { FormValues } from '@/lib/form-action';
import {
  type DeadlineStrategy,
  eventLabels,
  labelOf,
  sectionLabels,
  slotLabels,
  strategyLabels,
} from './labels';

/**
 * One control of the parameters form. `id` is the control id and the posted name at once. This
 * module owns the id scheme, the form only renders what it gets.
 */
export interface RegulationField {
  id: string;
  label: string;
  hint?: string;
  kind: 'number' | 'checkbox' | 'select' | 'text';
  /** A number with a fractional part (decimal comma). */
  decimal?: boolean;
  options?: { value: string; label: string }[];
  /** The current value as text, a checkbox is `'1'` or `''`. */
  value: string;
  /** Shown only while the strategy control of the slot holds one of these strategies. */
  strategyOf?: { slotField: string; strategies: string[] };
}

export interface RegulationFieldGroup {
  title: string;
  basis: string | null;
  fields: RegulationField[];
}

type Rule = RegulationDocument['deadlines'][DeadlineSlot] & {};

const STRATEGIES = Object.keys(strategyLabels) as DeadlineStrategy[];
const EVENTS = Object.keys(eventLabels);

/** Keys of a deadline rule the form edits, in the order of the controls. */
const RULE_KEYS = [
  'strategy',
  'event',
  'months',
  'days',
  'daysBefore',
  'daysAfter',
  'extendByAbsencesLongerThanMonth',
  'shiftToWorkingDay',
  'basis',
] as const;

const SCALAR_FIELDS: Readonly<Record<string, readonly string[]>> = {
  additionalCriteria: ['min', 'max'],
  justification: ['requiredForNegative', 'requiredForPositive'],
  termChange: ['minimumElapsedMonths'],
  gradeByLaw: ['consecutiveEvaluations'],
};

const numberText = (value: number): string => String(value).replace('.', ',');
const checkboxText = (value: boolean): string => (value ? '1' : '');
const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);
const lowerFirst = (text: string): string => text.charAt(0).toLowerCase() + text.slice(1);

/** Options of a select, plus the current value when this frontend does not know it yet. */
function optionsOf(
  labels: Readonly<Record<string, string>>,
  keys: readonly string[],
  current: string,
): { value: string; label: string }[] {
  const options = keys.map((key) => ({ value: key, label: labelOf(labels, key) }));
  if (!keys.includes(current)) options.push({ value: current, label: current });
  return options;
}

function ruleNumber(rule: Rule, key: string): string {
  const value = (rule as Record<string, unknown>)[key];
  return typeof value === 'number' ? numberText(value) : '';
}

function slotGroup(slot: string, rule: Rule): RegulationFieldGroup {
  const prefix = `deadlines.${slot}`;
  const slotField = `${prefix}.strategy`;
  const only = (strategies: DeadlineStrategy[]) => ({ slotField, strategies });
  const extend = (rule as { extendByAbsencesLongerThanMonth?: unknown })
    .extendByAbsencesLongerThanMonth;
  return {
    title: labelOf(slotLabels, slot),
    basis: rule.basis,
    fields: [
      {
        id: slotField,
        label: 'Sposób liczenia terminu',
        kind: 'select',
        options: optionsOf(strategyLabels, STRATEGIES, rule.strategy),
        value: rule.strategy,
      },
      {
        id: `${prefix}.event`,
        label: 'Zdarzenie, od którego liczy się termin',
        kind: 'select',
        options: optionsOf(eventLabels, EVENTS, rule.event),
        value: rule.event,
      },
      {
        id: `${prefix}.months`,
        label: 'Liczba miesięcy',
        kind: 'number',
        value: ruleNumber(rule, 'months'),
        strategyOf: only(['monthsFromEvent']),
      },
      {
        id: `${prefix}.days`,
        label: 'Liczba dni',
        kind: 'number',
        value: ruleNumber(rule, 'days'),
        strategyOf: only(['daysFromEvent']),
      },
      {
        id: `${prefix}.daysBefore`,
        label: 'Dni przed zdarzeniem',
        hint: 'Najwcześniej tyle dni przed zdarzeniem.',
        kind: 'number',
        value: ruleNumber(rule, 'daysBefore'),
        strategyOf: only(['windowAroundEvent']),
      },
      {
        id: `${prefix}.daysAfter`,
        label: 'Dni po zdarzeniu',
        hint: 'Najpóźniej tyle dni po zdarzeniu.',
        kind: 'number',
        value: ruleNumber(rule, 'daysAfter'),
        strategyOf: only(['windowAroundEvent']),
      },
      {
        id: `${prefix}.extendByAbsencesLongerThanMonth`,
        label: 'Przedłuż termin o nieobecność dłuższą niż miesiąc',
        kind: 'checkbox',
        value: checkboxText(extend === true),
        strategyOf: only(['monthsFromEvent']),
      },
      {
        id: `${prefix}.shiftToWorkingDay`,
        label: 'Przesuń termin na najbliższy dzień roboczy',
        hint: 'Gdy termin wypada w dzień wolny od pracy.',
        kind: 'checkbox',
        value: checkboxText(rule.shiftToWorkingDay),
      },
      { id: `${prefix}.basis`, label: 'Podstawa prawna', kind: 'text', value: rule.basis },
    ],
  };
}

/** Every editable parameter of a version as form groups: sections first, then one group per deadline slot. */
export function regulationFields(document: RegulationDocument): RegulationFieldGroup[] {
  const levelName = (code: string) =>
    document.partialScale.levels.find((level) => level.code === code)?.name ?? code;
  const groups: RegulationFieldGroup[] = [
    {
      title: labelOf(sectionLabels, 'additionalCriteria'),
      basis: document.additionalCriteria.basis,
      fields: [
        {
          id: 'additionalCriteria.min',
          label: 'Najmniejsza liczba kryteriów dodatkowych',
          kind: 'number',
          value: numberText(document.additionalCriteria.min),
        },
        {
          id: 'additionalCriteria.max',
          label: 'Największa liczba kryteriów dodatkowych',
          kind: 'number',
          value: numberText(document.additionalCriteria.max),
        },
      ],
    },
    {
      title: 'Przedziały poziomu oceny',
      basis: document.overallLevel.basis,
      fields: document.overallLevel.bands.flatMap((band, index): RegulationField[] => [
        {
          id: `bands.${index}.min`,
          label: `${capitalize(levelName(band.code))}, średnia od`,
          hint: band.minInclusive
            ? 'Ta wartość należy do przedziału.'
            : 'Ta wartość należy do poprzedniego przedziału.',
          kind: 'number',
          decimal: true,
          value: numberText(band.min),
        },
        {
          id: `bands.${index}.max`,
          label: `${capitalize(levelName(band.code))}, średnia do`,
          kind: 'number',
          decimal: true,
          value: numberText(band.max),
        },
      ]),
    },
    {
      title: labelOf(sectionLabels, 'justification'),
      basis: document.justification.basis,
      fields: [
        {
          id: 'justification.requiredForNegative',
          label: 'Uzasadnienie wymagane przy ocenie negatywnej',
          kind: 'checkbox',
          value: checkboxText(document.justification.requiredForNegative),
        },
        {
          id: 'justification.requiredForPositive',
          label: 'Uzasadnienie wymagane przy ocenie pozytywnej',
          kind: 'checkbox',
          value: checkboxText(document.justification.requiredForPositive),
        },
      ],
    },
    {
      title: labelOf(sectionLabels, 'termChange'),
      basis: document.termChange.basis,
      fields: [
        {
          id: 'termChange.minimumElapsedMonths',
          label: 'Najmniej miesięcy od początku okresu oceny',
          hint: 'Wcześniej termin oceny nie może się zmienić.',
          kind: 'number',
          value: numberText(document.termChange.minimumElapsedMonths),
        },
      ],
    },
    {
      title: labelOf(sectionLabels, 'gradeByLaw'),
      basis: document.gradeByLaw.basis,
      fields: [
        {
          id: 'gradeByLaw.consecutiveEvaluations',
          label: 'Liczba kolejnych ocen potrzebnych do stopnia',
          kind: 'number',
          value: numberText(document.gradeByLaw.consecutiveEvaluations),
        },
      ],
    },
  ];
  for (const [slot, rule] of Object.entries(document.deadlines)) groups.push(slotGroup(slot, rule));
  return groups;
}

/** The form values of a document, one per control. */
export function regulationFormValues(document: RegulationDocument): FormValues {
  const values: FormValues = {};
  for (const group of regulationFields(document)) {
    for (const field of group.fields) values[field.id] = field.value;
  }
  return values;
}

/** A typed number: a comma or a dot as the decimal sign, anything else (also empty) is `NaN`. */
function parseNumber(raw: string): number {
  const text = raw.trim().replace(',', '.');
  return /^-?\d+(\.\d+)?$/.test(text) ? Number(text) : Number.NaN;
}

/**
 * A copy of the document with the posted parameters written in. Numbers keep a typo as `NaN`, so the
 * domain schema reports the field. A number the form did not post keeps its saved value, a checkbox
 * the form did not post is unchecked.
 */
export function applyRegulationEdits(document: RegulationDocument, values: FormValues): unknown {
  const raw = (id: string): string | undefined => {
    const value = values[id];
    return typeof value === 'string' ? value : undefined;
  };
  const number = (id: string, saved: unknown): number => {
    const value = raw(id);
    if (value !== undefined) return parseNumber(value);
    return typeof saved === 'number' ? saved : Number.NaN;
  };
  const checked = (id: string): boolean => raw(id) === '1';

  const deadlines: Record<string, unknown> = {};
  for (const [slot, rule] of Object.entries(document.deadlines)) {
    const prefix = `deadlines.${slot}`;
    const saved = rule as Record<string, unknown>;
    const strategy = raw(`${prefix}.strategy`) ?? rule.strategy;
    const common = {
      strategy,
      event: raw(`${prefix}.event`) ?? rule.event,
      shiftToWorkingDay: checked(`${prefix}.shiftToWorkingDay`),
      basis: (raw(`${prefix}.basis`) ?? rule.basis).trim(),
    };
    const param = (key: string) => number(`${prefix}.${key}`, saved[key]);
    if (strategy === 'monthsFromEvent') {
      deadlines[slot] = {
        ...common,
        months: param('months'),
        extendByAbsencesLongerThanMonth: checked(`${prefix}.extendByAbsencesLongerThanMonth`),
      };
    } else if (strategy === 'daysFromEvent') {
      deadlines[slot] = { ...common, days: param('days') };
    } else if (strategy === 'windowAroundEvent') {
      deadlines[slot] = {
        ...common,
        daysBefore: param('daysBefore'),
        daysAfter: param('daysAfter'),
      };
    } else {
      // An unknown strategy: the schema rejects it at the strategy control.
      deadlines[slot] = { ...rule, ...common };
    }
  }

  return {
    ...document,
    additionalCriteria: {
      ...document.additionalCriteria,
      min: number('additionalCriteria.min', document.additionalCriteria.min),
      max: number('additionalCriteria.max', document.additionalCriteria.max),
    },
    overallLevel: {
      ...document.overallLevel,
      bands: document.overallLevel.bands.map((band, index) => ({
        ...band,
        min: number(`bands.${index}.min`, band.min),
        max: number(`bands.${index}.max`, band.max),
      })),
    },
    justification: {
      ...document.justification,
      requiredForNegative: checked('justification.requiredForNegative'),
      requiredForPositive: checked('justification.requiredForPositive'),
    },
    termChange: {
      ...document.termChange,
      minimumElapsedMonths: number(
        'termChange.minimumElapsedMonths',
        document.termChange.minimumElapsedMonths,
      ),
    },
    gradeByLaw: {
      ...document.gradeByLaw,
      consecutiveEvaluations: number(
        'gradeByLaw.consecutiveEvaluations',
        document.gradeByLaw.consecutiveEvaluations,
      ),
    },
    deadlines,
  };
}

/**
 * The form field of a schema issue path, `''` when the form has no such control (the issue then goes
 * to the form error). A problem with the bands as a whole lands on the first band.
 */
export function issueFieldId(path: readonly (string | number)[]): string {
  const [head, second, third, fourth] = path;
  if (typeof head !== 'string') return '';
  if (path.length === 2 && typeof second === 'string' && SCALAR_FIELDS[head]?.includes(second)) {
    return `${head}.${second}`;
  }
  if (head === 'overallLevel' && second === 'bands') {
    if (path.length === 2) return 'bands.0.min';
    if (path.length === 4 && typeof third === 'number' && (fourth === 'min' || fourth === 'max')) {
      return `bands.${third}.${fourth}`;
    }
    return '';
  }
  if (head === 'deadlines' && typeof second === 'string') {
    if (path.length === 2) return `deadlines.${second}.strategy`;
    if (path.length === 3 && (RULE_KEYS as readonly unknown[]).includes(third)) {
      return `deadlines.${second}.${String(third)}`;
    }
  }
  return '';
}

/** Names of the document parts for a path outside the form. */
const PATH_LABELS: Readonly<Record<string, string>> = {
  ...sectionLabels,
  id: 'Kod wersji',
  name: 'Nazwa wersji',
  effectiveFrom: 'Data wejścia w życie',
  legalBasis: 'Podstawa prawna wersji',
  sources: 'Źródła',
  sheets: 'Arkusze',
  deadlines: 'Terminy',
};

/** A readable path of an issue outside the form, e.g. `Źródła / pozycja 1 / text`. */
export function issuePathLabel(path: readonly (string | number)[]): string {
  return path
    .map((part, index) => {
      if (typeof part === 'number') return `pozycja ${part + 1}`;
      if (index === 0) return labelOf(PATH_LABELS, part);
      if (index === 1 && path[0] === 'deadlines') return labelOf(slotLabels, part);
      return part;
    })
    .join(' / ');
}

/** Domain messages of the cross-field checks, which carry no field kind to go by. */
const KNOWN_MESSAGES: readonly (readonly [RegExp, string])[] = [
  [
    /^min is greater than max$/,
    'Najmniejsza liczba kryteriów dodatkowych nie może być większa od największej',
  ],
  [/^bands must be contiguous$/, 'Przedział musi zaczynać się tam, gdzie kończy się poprzedni'],
  [
    /^bands must cover the whole partial scale$/,
    'Przedziały muszą obejmować całą skalę ocen cząstkowych, od najniższej do najwyższej liczby punktów',
  ],
  [/in the past/, 'Data wejścia w życie nie może być w przeszłości'],
  [/^invalid date/, 'Wpisz poprawną datę'],
];

const POLISH_LETTERS = /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/;

/**
 * A Polish message for a schema issue. The domain schema speaks English, so the message comes from
 * the kind of the control. A message already in Polish passes through.
 */
export function regulationIssueMessage(
  field: RegulationField | null,
  message: string,
  fallback = 'Popraw tę wartość',
): string {
  for (const [pattern, text] of KNOWN_MESSAGES) if (pattern.test(message)) return text;
  if (POLISH_LETTERS.test(message)) return message;
  if (field === null) return fallback;
  switch (field.kind) {
    case 'number':
      if (/received NaN|expected number, received/.test(message)) return 'Wpisz liczbę';
      if (message.includes('expected int')) return 'Wpisz liczbę całkowitą';
      if (/>=\s*0\b/.test(message)) return 'Wpisz liczbę równą 0 albo większą';
      if (/>\s*0\b/.test(message)) return 'Wpisz liczbę większą od 0';
      return 'Wpisz poprawną liczbę';
    case 'text':
      // The only text control of the form is the legal basis of a slot.
      return 'Wpisz podstawę prawną';
    case 'select':
      return field.id.endsWith('.event') ? 'Wybierz zdarzenie' : 'Wybierz sposób liczenia terminu';
    case 'checkbox':
      return fallback;
  }
}

/**
 * Field errors of the issues of a saved document, in Polish. Issues without a control in the form
 * come back as readable paths in `outside`, for the form error.
 */
export function regulationIssueErrors(
  document: RegulationDocument,
  issues: readonly RegulationIssue[],
): { fieldErrors: Record<string, string>; outside: string[] } {
  const fields = new Map(
    regulationFields(document)
      .flatMap((group) => group.fields)
      .map((field) => [field.id, field]),
  );
  const fieldErrors: Record<string, string> = {};
  const outside: string[] = [];
  for (const issue of issues) {
    const field = fields.get(issueFieldId(issue.path));
    if (field) {
      fieldErrors[field.id] ??= regulationIssueMessage(field, issue.message);
    } else {
      const label = issuePathLabel(issue.path);
      if (!outside.includes(label)) outside.push(label);
    }
  }
  return { fieldErrors, outside };
}

/** The controls of a group that apply to the strategy in `values` (or the saved one). */
export function visibleFields(
  group: RegulationFieldGroup,
  strategyOf: (slotField: string) => string = (slotField) =>
    group.fields.find((field) => field.id === slotField)?.value ?? '',
): RegulationField[] {
  return group.fields.filter(
    (field) =>
      !field.strategyOf ||
      field.strategyOf.strategies.includes(strategyOf(field.strategyOf.slotField)),
  );
}

/** A saved value as text for the read-only view of a published version. */
export function fieldDisplayValue(field: RegulationField): string {
  if (field.kind === 'checkbox') return field.value === '1' ? 'Tak' : 'Nie';
  if (field.kind === 'select') {
    return field.options?.find((option) => option.value === field.value)?.label ?? field.value;
  }
  return field.value;
}

/** The summary line of a field error: the group and the control, then the message. */
export function issueSummaryText(
  group: RegulationFieldGroup,
  field: RegulationField,
  message: string,
): string {
  return `${group.title}, ${lowerFirst(field.label)}: ${lowerFirst(message)}`;
}
