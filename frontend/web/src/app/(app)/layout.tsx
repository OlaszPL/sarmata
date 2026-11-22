import type { ReactNode } from 'react';
import { MemberShell } from '@/components/shell/member-shell';
import { requireMember } from '@/lib/account';

/** Layout of every signed-in screen. Domain screens of the functional thread go into this group. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const account = await requireMember();
  return <MemberShell account={account}>{children}</MemberShell>;
}
