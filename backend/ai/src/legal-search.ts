import { type LegalFragment, type LegalSource } from '@sarmata/domain';
import { type AiResult, failure } from './result';

/** Retrieval over the legal texts of a regulation version (the RAG of the procedure assistant). */
export interface LegalSearch {
  /** Fragments of the corpus files only, best first. */
  search(
    query: string,
    corpus: readonly LegalSource[],
    signal?: AbortSignal,
  ): Promise<AiResult<LegalFragment[]>>;
}

/** Where no search is configured. */
export const unavailableLegalSearch: LegalSearch = {
  search: () => Promise.resolve(failure('unavailable', 'Legal search is not configured')),
};
