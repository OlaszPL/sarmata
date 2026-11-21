import { type AiPartialOutput, type AiRunKind } from '@sarmata/domain';
import { type GenerationProgress } from './text-model';

/** The state of a running run, for the worker to store (`ai_runs.partial_*`, `output_tokens`). */
export interface AiRunProgress {
  /** Raw text of the model call in progress (JSON the model is still writing). */
  readonly text: string;
  /** Output tokens of every call of the run so far. */
  readonly outputTokens: number;
  /** Finished part of the output, matching `aiPartialOutputSchemas[kind]`. Null before anything finished. */
  readonly partialOutput: unknown;
}

/** How a task reports progress. Tasks that call the model several times start each call here. */
export interface TaskProgress<K extends AiRunKind> {
  /**
   * Starts one model call, its tokens add to the run total. Returns the listener for the stream of
   * that call, which may also pass the output finished so far.
   */
  call(): (generation: GenerationProgress, partial?: AiPartialOutput<K> | null) => void;
  /** The output finished so far, between calls. */
  output(partial: AiPartialOutput<K>): void;
}

export interface RunProgressTracker<K extends AiRunKind> extends TaskProgress<K> {
  /** Output tokens of the whole run so far. */
  readonly outputTokens: number;
}

/** Sums the tokens of the calls of one run and reports the whole state on every change. */
export function trackRunProgress<K extends AiRunKind>(
  listener: ((progress: AiRunProgress) => void) | undefined,
): RunProgressTracker<K> {
  let finishedTokens = 0;
  let callTokens = 0;
  let text = '';
  let partialOutput: unknown = null;
  const emit = (): void => {
    listener?.({ text, outputTokens: finishedTokens + callTokens, partialOutput });
  };
  return {
    get outputTokens() {
      return finishedTokens + callTokens;
    },
    call() {
      finishedTokens += callTokens;
      callTokens = 0;
      text = '';
      return (generation, partial) => {
        callTokens = generation.outputTokens;
        text = generation.text;
        if (partial) partialOutput = partial;
        emit();
      };
    },
    output(partial) {
      partialOutput = partial;
      emit();
    },
  };
}
