import type { ReactNode } from 'react';
import { AppShell } from '@sarmata/ui';
import { AccountBar } from '@/components/account-bar';
import { requireMember } from '@/lib/account';
import { product } from '@/lib/product';

/** Layout of every signed-in screen. Domain screens of the functional thread go into this group. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const account = await requireMember();

  return (
    <AppShell product={product} account={<AccountBar account={account} />}>
      {children}
    </AppShell>
  );
}
