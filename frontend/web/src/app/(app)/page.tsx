import type { Metadata } from 'next';
import { requireMember } from '@/lib/account';
import { roleLabels } from '@/lib/role-labels';

export const metadata: Metadata = { title: 'Start' };

export default async function HomePage() {
  const account = await requireMember();

  return (
    <section aria-labelledby="start-heading">
      <h1 id="start-heading" className="text-3xl font-bold">
        Start
      </h1>
      <p className="mt-4 max-w-prose">
        Pracujesz w urzędzie {account.office.name} z rolą {roleLabels[account.role]}. Tu pojawią się
        Twoje oceny okresowe i terminy.
      </p>
    </section>
  );
}
