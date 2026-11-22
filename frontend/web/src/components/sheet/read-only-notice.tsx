import { Notice } from '@sarmata/ui';
import { type CaseData } from '@/app/(app)/oceny/[id]/loader';
import { serviceErrorMessage } from '@/lib/service-errors';

/** Why a sheet tab shows no forms: the same notice on parts II, III and the check page. */
export function ReadOnlyNotice({ data }: { data: Pick<CaseData, 'isAdmin' | 'isHr'> }) {
  return (
    <Notice tone="info">
      <p>Arkusz jest tylko do odczytu.</p>
      {data.isAdmin ? <p>{serviceErrorMessage('forbidden')}</p> : null}
      {data.isHr ? <p>Arkusz wypełnia osoba, która prowadzi ocenę.</p> : null}
    </Notice>
  );
}
