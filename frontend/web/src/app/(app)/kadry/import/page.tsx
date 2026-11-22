import type { Metadata } from 'next';
import { HrPage } from '@/components/hr/hr-page';
import { requireMember } from '@/lib/account';
import { hrAccess } from '@/lib/hr/access';
import { ImportWizard } from './import-wizard';

export const metadata: Metadata = { title: 'Import pracowników' };

/** Employee CSV import in four steps. Only hr writes, so other roles get the notice. */
export default async function ImportPage() {
  const account = await requireMember();
  const allowed = hrAccess(account.role, 'import') === 'write';
  return (
    <HrPage
      title="Import pracowników"
      meta="Wczytaj listę z systemu kadrowego. Przed zapisem zobaczysz przebieg próbny."
      {...(allowed ? {} : { denied: 'import pracowników' })}
    >
      <ImportWizard />
    </HrPage>
  );
}
