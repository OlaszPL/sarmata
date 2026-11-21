import { describe, expect, it } from 'vitest';
import { asciiFileName, attachmentDisposition } from './content-disposition';

describe('attachmentDisposition', () => {
  it('file name with Polish letters gets an ASCII filename and a UTF-8 filename*', () => {
    const header = attachmentDisposition('arkusz-C-Łukasiewicz-Żaneta-2026-06-15.pdf');
    expect(header).toBe(
      `attachment; filename="arkusz-C-Lukasiewicz-Zaneta-2026-06-15.pdf"; filename*=UTF-8''arkusz-C-%C5%81ukasiewicz-%C5%BBaneta-2026-06-15.pdf`,
    );
    expect(header).toMatch(/^[\x20-\x7e]+$/);
  });

  it('every Polish letter folds to ASCII', () => {
    expect(asciiFileName('ąćęłńóśźżĄĆĘŁŃÓŚŹŻ.pdf')).toBe('acelnoszzACELNOSZZ.pdf');
  });

  it('quotes and apostrophes cannot break the header', () => {
    const header = attachmentDisposition(`a"b'c(d).pdf`);
    expect(header).toContain('filename="ab\'c(d).pdf"');
    expect(header).toContain("filename*=UTF-8''a%22b%27c%28d%29.pdf");
  });
});
