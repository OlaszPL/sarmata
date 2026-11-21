import { type LegalFragment } from '@sarmata/domain';
import { z } from 'zod';
import { type Task, ok, withSignal } from './task';

const NO_FRAGMENTS =
  'Brak fragmentów przepisów, które odpowiadają na to pytanie. Sprawdź pytanie albo zapytaj kadry.';

const describeFragments = (fragments: readonly LegalFragment[]): string =>
  fragments
    .map(
      (fragment) =>
        `[${fragment.id}] ${fragment.title} (${fragment.citation}), linie ${fragment.startLine} do ${fragment.endLine}:\n${fragment.text}`,
    )
    .join('\n\n');

/**
 * Procedure assistant (RAG): semble finds the fragments in the legal texts of the regulation version,
 * the text model answers with citations of the fragment numbers. The answer is grounded when at least
 * one citation stays.
 */
export const procedureQuestion: Task<'procedure_question'> = async (
  input,
  { ai, legalSearch, system },
  signal,
) => {
  const found = await legalSearch.search(input.question, input.corpus, signal);
  if (!found.ok) return found;
  const fragments = found.value;
  const [first, ...rest] = fragments.map((fragment) => fragment.id);
  if (first === undefined) {
    return ok({ answer: NO_FRAGMENTS, grounded: false, citations: [], fragments: [] });
  }
  const result = await ai.generateObject({
    schemaName: 'procedure_question',
    schema: z.object({
      answer: z.string(),
      citations: z.array(
        z.object({ fragmentId: z.literal([first, ...rest]), reference: z.string() }),
      ),
    }),
    system,
    prompt:
      `Dzisiaj jest ${input.today}.\n\nFragmenty przepisów:\n${describeFragments(fragments)}\n\n` +
      `Pytanie:\n${input.question}`,
    ...withSignal(signal),
  });
  if (!result.ok) return result;
  const citations = result.value.citations;
  return ok({ answer: result.value.answer, grounded: citations.length > 0, citations, fragments });
};
