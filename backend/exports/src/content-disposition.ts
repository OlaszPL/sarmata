/** Polish letters that have no decomposition, so `normalize('NFD')` alone leaves them in place. */
const FOLD: Readonly<Record<string, string>> = { ł: 'l', Ł: 'L' };

/** ASCII only fallback of a file name: Polish letters lose their marks, the rest becomes `_`. */
export function asciiFileName(fileName: string): string {
  return fileName
    .replace(/[łŁ]/g, (letter) => FOLD[letter] ?? letter)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/["\\]/g, '')
    .replace(/[^\x20-\x7e]/g, '_');
}

/** RFC 5987 value: `encodeURIComponent` also leaves `'()*` alone, which `filename*` must escape. */
const encodeRfc5987 = (text: string): string =>
  encodeURIComponent(text).replace(
    /['()*]/g,
    (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
  );

/**
 * `Content-Disposition` for a download: an ASCII `filename` for old clients and `filename*` with the
 * real name in UTF-8 (RFC 6266).
 */
export function attachmentDisposition(fileName: string): string {
  return `attachment; filename="${asciiFileName(fileName)}"; filename*=UTF-8''${encodeRfc5987(fileName)}`;
}
