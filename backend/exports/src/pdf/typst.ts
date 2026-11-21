import { NodeCompiler } from '@myriaddreamin/typst-ts-node-compiler';
import { PDF_FONT_FAMILY, resolveFontsDir } from './font';

export interface RenderOptions {
  /** `ua-1` for the downloadable sheet, `a-2a` for the EZD package. The binding takes one standard. */
  readonly standard: 'ua-1' | 'a-2a';
  /** Creation time written to the file. The same input and time give the same bytes. */
  readonly createdAt: Date;
}

let compiler: NodeCompiler | undefined;

/**
 * One lazy compiler per process. The Open Sans files of the package are searched recursively, so the
 * named family never depends on the machine. The compiler cannot switch off its system and built-in
 * fonts, they only serve as glyph fallback.
 */
function sharedCompiler(): NodeCompiler {
  compiler ??= NodeCompiler.create({ fontArgs: [{ fontPaths: [resolveFontsDir()] }] });
  return compiler;
}

/**
 * Renders a template to PDF. The data goes in as one JSON input (`sys.inputs.data`) that the template
 * reads with `json(bytes(sys.inputs.data))`. `fontFamily` defaults to `PDF_FONT_FAMILY`, so no template
 * knows a typeface name. Errors of the standard (for example PDF/UA rules) throw.
 */
export function renderPdf(template: string, data: unknown, options: RenderOptions): Uint8Array {
  const input = JSON.stringify({
    fontFamily: PDF_FONT_FAMILY,
    ...(data as Record<string, unknown>),
  });
  const buffer = sharedCompiler().pdf(
    { mainFileContent: template, inputs: { data: input } },
    {
      pdfStandard: options.standard,
      creationTimestamp: Math.floor(options.createdAt.getTime() / 1000),
    },
  );
  return new Uint8Array(buffer);
}
