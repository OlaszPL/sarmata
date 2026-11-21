import { archiveFor, attachmentDisposition } from '@sarmata/exports';
import { ServiceError, type ServiceErrorCode } from '@sarmata/services';
import { z } from 'zod';
import { createSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.uuid() });

const STATUS: Partial<Record<ServiceErrorCode, number>> = {
  not_found: 404,
  not_ended: 409,
  forbidden: 403,
};

/**
 * Downloads the archive of the case files of a former employee (hr only). The ZIP is built on request
 * with the JWT of the user. The download is recorded only after the whole file exists.
 */
export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const parsed = paramsSchema.safeParse(await context.params);
  if (!parsed.success) return Response.json({ error: 'not_found' }, { status: 404 });

  const db = await createSupabase();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) return Response.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const file = await archiveFor(db).exportEmployeeArchive(parsed.data.id);
    return new Response(new Uint8Array(file.bytes), {
      headers: {
        'Content-Type': file.contentType,
        'Content-Disposition': attachmentDisposition(file.fileName),
        'Content-Length': String(file.bytes.byteLength),
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const status = error instanceof ServiceError ? STATUS[error.code] : undefined;
    if (error instanceof ServiceError && status !== undefined) {
      return Response.json({ error: error.code }, { status });
    }
    throw error;
  }
}
