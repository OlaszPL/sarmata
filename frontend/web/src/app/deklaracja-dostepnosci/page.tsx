import type { Metadata } from 'next';
import { type OfficeAccessibility, servicesFor } from '@sarmata/services';
import { AppShell } from '@sarmata/ui';
import { Statement } from '@/components/accessibility/statement';
import { A11yTools } from '@/components/shell/a11y-tools';
import { MemberShell } from '@/components/shell/member-shell';
import { SiteFooter } from '@/components/shell/site-footer';
import { currentAccount } from '@/lib/account';
import { product } from '@/lib/product';
import { createSupabase } from '@/lib/supabase';

export const metadata: Metadata = { title: 'Deklaracja dostępności' };

/** Office data of the statement from the settings, `null` when they cannot be read. */
async function officeAccessibility(): Promise<OfficeAccessibility | null> {
  try {
    const settings = await servicesFor(await createSupabase()).officeSettings.get();
    return settings.accessibility;
  } catch (error) {
    console.error('deklaracja-dostepnosci: office settings failed', error);
    return null;
  }
}

/**
 * Public on purpose: people who hit a barrier before signing in must be able to read it. Members
 * see it in their full shell with the office data from the settings, everyone else in the plain
 * one with the generic texts.
 */
export default async function AccessibilityStatementPage() {
  const account = await currentAccount();
  if (account.status === 'member') {
    return (
      <MemberShell account={account}>
        <Statement officeName={account.office.name} accessibility={await officeAccessibility()} />
      </MemberShell>
    );
  }
  return (
    <AppShell product={product} tools={<A11yTools />} footer={<SiteFooter publicOnly />}>
      <Statement officeName={null} />
    </AppShell>
  );
}
