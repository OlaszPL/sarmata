import type { Metadata } from 'next';
import { type NoteVersion, servicesFor } from '@sarmata/services';
import { Notice } from '@sarmata/ui';
import { CardHero } from '@/components/employees/card-hero';
import { CardNotes, cardNoteFilter } from '@/components/employees/card-notes';
import { CriteriaChangeTable } from '@/components/employees/criteria-change-table';
import { HrActions } from '@/components/employees/hr-actions';
import { HrPartnerPanel } from '@/components/employees/hr-partner-panel';
import { RatingHistory } from '@/components/employees/rating-history';
import { NoteSavedNotice } from '@/components/notes/note-saved-notice';
import { loadCard } from '@/lib/employees/load-card';
import { formatDate } from '@/lib/format';
import { createSupabase } from '@/lib/supabase';

type SearchParams = Record<string, string | string[] | undefined>;

interface CardPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

function single(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? '';
}

export async function generateMetadata({ params }: CardPageProps): Promise<Metadata> {
  const { employee } = await loadCard((await params).id);
  return { title: `Karta pracownika, ${employee.firstName} ${employee.lastName}` };
}

/** Versions of a visible note of this person, null when it failed to load. */
async function noteHistory(id: string): Promise<NoteVersion[] | null> {
  try {
    return await servicesFor(await createSupabase()).notes.history(id);
  } catch {
    return null;
  }
}

/**
 * Employee card (mockup 2026-11-22-karta-pencil.html): hero, the evaluation record, the change in
 * criteria, the notes and the hr-only block, with the HR partner panel on the side.
 */
export default async function EmployeeCardPage({ params, searchParams }: CardPageProps) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const data = await loadCard(id);

  const historyId = single(query.historia);
  const historyVisible = Boolean(historyId && data.notes?.some((note) => note.id === historyId));
  const history = historyVisible ? await noteHistory(historyId) : null;
  const added = single(query.dodano) === '1';
  const saved = single(query.zapisano) === '1';
  const role = data.account.role;
  const canAnalyse = (role === 'evaluator' || role === 'hr') && data.notes !== null;

  return (
    <div className="flex flex-1 flex-col">
      <CardHero data={data} />
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="min-w-0 flex-1">
          {added || saved ? (
            <div className="grid gap-4 px-6 pt-6 sm:px-8">
              {added ? (
                <Notice tone="success" role="status">
                  <p>Dodano pracownika.</p>
                </Notice>
              ) : null}
              <NoteSavedNotice searchParams={query} />
            </div>
          ) : null}
          <RatingHistory rows={data.history.rows} />
          <CriteriaChangeTable criteria={data.history.criteria} />
          <CardNotes
            data={data}
            filter={cardNoteFilter(query)}
            formParam={single(query.notatka)}
            history={history}
            historyFailed={Boolean(historyId) && history === null}
          />
          {role === 'hr' ? (
            <HrActions
              employeeId={data.employee.id}
              today={data.today}
              levels={data.levels}
              scale={data.scale}
              criteria={data.sheetMandatory.map((criterionId) => ({
                id: criterionId,
                name: data.criteriaNames.get(criterionId) ?? criterionId,
              }))}
              employmentEndedOn={
                data.employee.employmentEndedOn ? formatDate(data.employee.employmentEndedOn) : null
              }
            />
          ) : null}
        </div>
        <HrPartnerPanel data={data} canAnalyse={canAnalyse} />
      </div>
    </div>
  );
}
