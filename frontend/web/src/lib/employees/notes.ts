/** Longest note body, the same as `NOTE_BODY_MAX_LENGTH` of the backend. */
export const NOTE_BODY_MAX = 5000;

/** How the sensitive data guard checked a note: by the AI model or by the dictionary only. */
export type AiNote = 'done' | 'dictionary_only' | 'skipped' | 'ai_disabled';

/** What the form and the success message say about a check without the AI model. */
const AI_NOTE_TEXTS: Record<AiNote, string | null> = {
  done: null,
  dictionary_only: 'Sprawdzono tylko słownikiem, bo model AI nie odpowiedział.',
  skipped: 'Sprawdzono tylko słownikiem.',
  ai_disabled: 'AI jest wyłączone w ustawieniach urzędu. Sprawdzono tylko słownikiem.',
};

/** Value of `sprawdzono` that `saveNote` adds to the URL after a save. */
const AI_NOTE_PARAMS: Partial<Record<AiNote, string>> = {
  dictionary_only: 'slownik',
  skipped: 'pominieto',
  ai_disabled: 'ai-wylaczone',
};

function isAiNote(value: string): value is AiNote {
  return Object.hasOwn(AI_NOTE_TEXTS, value);
}

/** The sentence for a check without the AI model, null after a full check or for unknown input. */
export function aiNoteText(aiNote: string): string | null {
  return isAiNote(aiNote) ? AI_NOTE_TEXTS[aiNote] : null;
}

/** The `sprawdzono` value of the form field `aiNote`, null when the message needs none. */
export function aiNoteParam(aiNote: string): string | null {
  return isAiNote(aiNote) ? (AI_NOTE_PARAMS[aiNote] ?? null) : null;
}

/** The sentence for a `sprawdzono` value of the URL. */
export function aiNoteTextOfParam(param: string): string | null {
  const entry = Object.entries(AI_NOTE_PARAMS).find(([, value]) => value === param);
  return entry ? aiNoteText(entry[0]) : null;
}
