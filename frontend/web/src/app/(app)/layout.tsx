import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import { AppShell } from '@sarmata/ui';
import { A11yTools } from '@/components/shell/a11y-tools';
import { AccountCell } from '@/components/shell/account-cell';
import { MainNav } from '@/components/shell/main-nav';
import { NotificationsCell } from '@/components/shell/notifications-cell';
import { SiteFooter } from '@/components/shell/site-footer';
import { requireMember } from '@/lib/account';
import { canStartEvaluation, navForRole } from '@/lib/nav';
import { product } from '@/lib/product';
import { routes } from '@/lib/routes';

/** Layout of every signed-in screen. Domain screens of the functional thread go into this group. */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const account = await requireMember();

  return (
    <AppShell
      product={product}
      homeHref={routes.home}
      nav={<MainNav items={navForRole(account.role)} />}
      tools={
        <>
          <div className="border-rule hidden border-l sm:flex">
            <Link
              href={routes.employees}
              className="font-heading flex min-h-16 items-center gap-2 px-5 font-medium"
            >
              <Search className="size-5" aria-hidden />
              Szukaj
            </Link>
          </div>
          <A11yTools />
          <NotificationsCell />
          <AccountCell account={account} />
        </>
      }
      primaryAction={
        canStartEvaluation(account.role) ? (
          <Link
            href={routes.newEvaluation}
            className="bg-navy font-heading flex items-center gap-2 px-6 font-medium text-white no-underline"
          >
            <Plus className="size-5" aria-hidden />
            Nowa ocena
          </Link>
        ) : null
      }
      footer={<SiteFooter />}
    >
      {children}
    </AppShell>
  );
}
