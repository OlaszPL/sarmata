import type { Metadata } from 'next';
import { AppShell } from '@sarmata/ui';
import { Statement } from '@/components/accessibility/statement';
import { A11yTools } from '@/components/shell/a11y-tools';
import { MemberShell } from '@/components/shell/member-shell';
import { SiteFooter } from '@/components/shell/site-footer';
import { currentAccount } from '@/lib/account';
import { product } from '@/lib/product';

export const metadata: Metadata = { title: 'Deklaracja dostępności' };

/**
 * Public on purpose: people who hit a barrier before signing in must be able to read it. Members
 * see it in their full shell, everyone else in the plain one.
 */
export default async function AccessibilityStatementPage() {
  const account = await currentAccount();
  if (account.status === 'member') {
    return (
      <MemberShell account={account}>
        <Statement officeName={account.office.name} />
      </MemberShell>
    );
  }
  return (
    <AppShell product={product} tools={<A11yTools />} footer={<SiteFooter publicOnly />}>
      <Statement officeName={null} />
    </AppShell>
  );
}
