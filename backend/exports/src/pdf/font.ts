import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The single place that names the document font. Templates read the name from their data
 * (`data.fontFamily`), `renderPdf` fills it from here and the DOCX adapter reads the same constant.
 *
 * Open Sans (SIL OFL 1.1), chosen by the user. The files live in `backend/exports/fonts/open-sans/`
 * (variable fonts, pinned source in the README there). To change the face: change this constant
 * and replace the files in that folder.
 */
export const PDF_FONT_FAMILY = 'Open Sans';

const FONT_FILE = join('open-sans', 'OpenSans-Regular.ttf');

/**
 * Directory with the font files given to the compiler. Next bundles this module, so `import.meta.url`
 * no longer points into the package. The candidates are the package itself (tests, worker) and the
 * repo root as seen from the web app directory (`next dev`, standalone server, see
 * `outputFileTracingIncludes` in `frontend/web/next.config.mjs`).
 */
export function resolveFontsDir(): string {
  const candidates = [
    join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'fonts'),
    join(process.cwd(), '..', '..', 'backend', 'exports', 'fonts'),
    join(process.cwd(), 'backend', 'exports', 'fonts'),
  ];
  const found = candidates.find((directory) => existsSync(join(directory, FONT_FILE)));
  if (!found)
    throw new Error(`Open Sans font files not found, looked in: ${candidates.join(', ')}`);
  return found;
}
