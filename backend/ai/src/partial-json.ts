/**
 * Parses the beginning of a JSON text the model is still writing. Keeps only what is already
 * complete: an array holds its finished elements, an object its finished members, and an unfinished
 * member that is an object or an array with its own finished part. Unfinished strings, numbers and
 * literals are left out. `undefined` when nothing is complete yet or the text is not JSON.
 */
export function parsePartialJson(text: string): unknown {
  try {
    return new PartialParser(text).value()?.value;
  } catch {
    return undefined;
  }
}

interface Parsed {
  readonly value: unknown;
  readonly complete: boolean;
}

class PartialParser {
  private index = 0;

  constructor(private readonly text: string) {}

  value(): Parsed | null {
    this.skipWhitespace();
    if (this.atEnd()) return null;
    const char = this.text[this.index];
    if (char === '{') return this.object();
    if (char === '[') return this.array();
    if (char === '"') return this.string();
    return this.primitive();
  }

  private atEnd(): boolean {
    return this.index >= this.text.length;
  }

  private skipWhitespace(): void {
    while (!this.atEnd() && /\s/.test(this.text[this.index] ?? '')) this.index += 1;
  }

  private object(): Parsed {
    this.index += 1;
    const result: Record<string, unknown> = {};
    const partial = (): Parsed => ({ value: result, complete: false });
    for (;;) {
      this.skipWhitespace();
      if (this.atEnd()) return partial();
      const char = this.text[this.index];
      if (char === '}') {
        this.index += 1;
        return { value: result, complete: true };
      }
      if (char === ',') {
        this.index += 1;
        continue;
      }
      const key = this.string();
      if (typeof key?.value !== 'string') return partial();
      this.skipWhitespace();
      if (this.atEnd() || this.text[this.index] !== ':') return partial();
      this.index += 1;
      const member = this.value();
      if (member === null) return partial();
      if (member.complete || (typeof member.value === 'object' && member.value !== null)) {
        result[key.value] = member.value;
      }
      if (!member.complete) return partial();
    }
  }

  private array(): Parsed {
    this.index += 1;
    const result: unknown[] = [];
    const partial = (): Parsed => ({ value: result, complete: false });
    for (;;) {
      this.skipWhitespace();
      if (this.atEnd()) return partial();
      const char = this.text[this.index];
      if (char === ']') {
        this.index += 1;
        return { value: result, complete: true };
      }
      if (char === ',') {
        this.index += 1;
        continue;
      }
      const element = this.value();
      if (!element?.complete) return partial();
      result.push(element.value);
    }
  }

  private string(): Parsed | null {
    if (this.text[this.index] !== '"') throw new SyntaxError('Expected a string');
    const start = this.index;
    this.index += 1;
    while (!this.atEnd()) {
      const char = this.text[this.index];
      if (char === '\\') {
        this.index += 2;
        continue;
      }
      this.index += 1;
      if (char === '"')
        return { value: JSON.parse(this.text.slice(start, this.index)), complete: true };
    }
    return null;
  }

  /** A number or literal is complete once something follows it: `1` may still become `12`. */
  private primitive(): Parsed | null {
    const start = this.index;
    while (!this.atEnd() && /[\w.+-]/.test(this.text[this.index] ?? '')) this.index += 1;
    if (this.atEnd()) return null;
    return { value: JSON.parse(this.text.slice(start, this.index)), complete: true };
  }
}
