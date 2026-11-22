import type { ReactNode } from 'react';
import Link from 'next/link';
import { Plus, Search } from 'lucide-react';
import type { MemberAccount } from '@sarmata/services';
import { AppShell } from '@sarmata/ui';
import { canStartEvaluation, navForRole } from '@/lib/nav';
import { product } from '@/lib/product';
import { routes } from '@/lib/routes';
import { A11yTools } from './a11y-tools';
import { AccountCell } from './account-cell';
import { MainNav } from './main-nav';
import { NotificationsCell } from './notifications-cell';
import { SiteFooter } from './site-footer';

/** The full shell of a signed-in member: role navigation, tools, account and the primary action. */
export function MemberShell({
  account,
  children,
}: {
  account: MemberAccount;
  children: ReactNode;
}) {
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
              className="font-heading flex min-h-16 items-center gap-2.5 px-[1.125rem] leading-[normal] font-medium"
            >
              <Search className="size-5" aria-hidden />
              {/* The label shows from 1440px, below the header needs the room for one line. */}
              <span className="sr-only min-[90rem]:not-sr-only">Szukaj</span>
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
            className="bg-navy font-heading flex shrink-0 items-center gap-2.5 px-6 text-[1.0625rem] leading-[normal] font-semibold whitespace-nowrap text-white no-underline"
          >
            <Plus className="size-5" aria-hidden />
            <span className="sr-only sm:not-sr-only">Nowa ocena</span>
          </Link>
        ) : null
      }
      footer={<SiteFooter />}
    >
      {children}
    </AppShell>
  );
}
