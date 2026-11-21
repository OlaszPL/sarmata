import { fileURLToPath } from 'node:url';

/**
 * The single place that names the document font. Templates read the name from their data
 * (`data.fontFamily`), `renderPdf` fills it from here and the DOCX adapter reads the same constant.
 *
 * TEMPORARY VALUE. The typeface of the documents is chosen by the user in the frontend thread, see
 * plan B6 task 3A. `Libertinus Serif` ships inside the Typst compiler, so no font files are needed
 * yet. This is not a choice of the document typeface and it does not replace that decision.
 * To change the face: change this constant and put the font files in `backend/exports/fonts/`.
 */
export const PDF_FONT_FAMILY = 'Libertinus Serif';

/** Directory with the font files given to the compiler. Resolved from this module, not from cwd. */
export const FONTS_DIR = fileURLToPath(new URL('../../fonts', import.meta.url));
