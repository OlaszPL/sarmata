import { type EvaluationStatus } from '@sarmata/services';
import { Notice } from '@sarmata/ui';
import { type CaseData } from '@/app/(app)/oceny/[id]/loader';
import { serviceErrorMessage } from '@/lib/service-errors';

const APPROVED: ReadonlySet<EvaluationStatus> = new Set([
  'drafted',
  'delivered',
  'objection',
  'closed',
]);

/**
 * Why a sheet tab shows no forms: the same notice on parts II, III and the check page. The person
 * who leads the evaluation reads that the sheet is approved, HR and admin why it is not theirs.
 */
export function ReadOnlyNotice({
  data,
}: {
  data: Pick<CaseData, 'isAdmin' | 'isHr' | 'canWrite'> & {
    view: Pick<CaseData['view'], 'status'>;
  };
}) {
  const approvedForLeader = data.canWrite && APPROVED.has(data.view.status);
  return (
    <Notice tone="info">
      <p>
        {approvedForLeader
          ? 'Arkusz jest zatwierdzony, więc nie można go już zmienić.'
          : 'Arkusz jest tylko do odczytu.'}
      </p>
      {data.isAdmin ? <p>{serviceErrorMessage('forbidden')}</p> : null}
      {data.isHr ? <p>Arkusz wypełnia osoba, która prowadzi ocenę.</p> : null}
    </Notice>
  );
}
