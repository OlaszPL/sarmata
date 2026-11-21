import {
  ExportError,
  type ExportRequest,
  attachmentDisposition,
  exportsFor,
} from '@sarmata/exports';
import { z } from 'zod';
import { createSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.uuid(),
  rodzaj: z.enum(['arkusz-pdf', 'arkusz-docx', 'zawiadomienie', 'teczka', 'paczka-ezd']),
});

const STATUS: Record<ExportError['code'], number> = {
  not_found: 404,
  unknown_event: 404,
  not_exportable: 409,
  unsupported_regulation: 422,
};

function requestFor(kind: z.infer<typeof paramsSchema>['rodzaj'], query: URLSearchParams) {
  const signatureBox = query.get('podpis') === '1';
  switch (kind) {
    case 'arkusz-pdf':
      return { kind: 'sheet_pdf', signatureBox } satisfies ExportRequest;
    case 'arkusz-docx':
      return { kind: 'sheet_docx', signatureBox } satisfies ExportRequest;
    case 'zawiadomienie': {
      const eventId = z.uuid().safeParse(query.get('zdarzenie'));
      if (!eventId.success) return null;
      return { kind: 'term_notice', eventId: eventId.data, signatureBox } satisfies ExportRequest;
    }
    case 'teczka':
      return { kind: 'case_file' } satisfies ExportRequest;
    case 'paczka-ezd': {
      const caseMark = query.get('znak')?.trim();
      return {
        kind: 'ezd_package',
        ...(caseMark === undefined || caseMark === '' ? {} : { caseMark }),
      } satisfies ExportRequest;
    }
  }
}

/**
 * Downloads a generated document of an evaluation. The file is built on request with the JWT of the
 * user, so RLS decides who gets what. Nothing is stored.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ id: string; rodzaj: string }> },
): Promise<Response> {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) {
    const badId = parsed.error.issues.some((issue) => issue.path[0] === 'id');
    return Response.json(
      { error: badId ? 'not_found' : 'bad_kind' },
      { status: badId ? 404 : 400 },
    );
  }
  const exportRequest = requestFor(parsed.data.rodzaj, new URL(request.url).searchParams);
  if (exportRequest === null) return Response.json({ error: 'missing_event' }, { status: 400 });

  const db = await createSupabase();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) return Response.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const file = await exportsFor(db).export(parsed.data.id, exportRequest);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': attachmentDisposition(file.fileName),
        'Content-Length': String(file.bytes.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ExportError) {
      return Response.json({ error: error.code }, { status: STATUS[error.code] });
    }
    throw error;
  }
}
