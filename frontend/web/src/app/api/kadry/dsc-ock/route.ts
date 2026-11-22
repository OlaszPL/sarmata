import { ServiceError, dscOckCsv, servicesFor } from '@sarmata/services';
import { parseYear } from '@/lib/hr/statistics-view';
import { createSupabase } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** DSC-OCK answers of a year as a CSV for Excel (hr and admin). The year is required and validated. */
export async function GET(request: Request): Promise<Response> {
  const raw = new URL(request.url).searchParams.get('rok') ?? undefined;
  const year = parseYear(raw, Number.NaN);
  if (Number.isNaN(year)) return Response.json({ error: 'bad_year' }, { status: 400 });

  const db = await createSupabase();
  const { data } = await db.auth.getClaims();
  if (!data?.claims) return Response.json({ error: 'unauthorized' }, { status: 401 });

  try {
    const report = await servicesFor(db).statistics.officeReport(year);
    return new Response(dscOckCsv(report.dscOck), {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="dsc-ock-${year}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'forbidden') {
      return Response.json({ error: 'forbidden' }, { status: 403 });
    }
    if (error instanceof ServiceError && error.code === 'no_regulation_in_force') {
      return Response.json({ error: 'not_found' }, { status: 404 });
    }
    throw error;
  }
}
