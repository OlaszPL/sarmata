import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell, Button } from '@sarmata/ui';
import { currentAccount } from '@/lib/account';
import { signOut } from '@/lib/auth-actions';
import { SiteFooter } from '@/components/shell/site-footer';
import { product } from '@/lib/product';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Brak urzędu' };

export default async function NoOfficePage() {
  const account = await currentAccount();
  if (account.status === 'signed-out') redirect(routes.signIn);
  if (account.status === 'member') redirect(routes.home);

  return (
    <AppShell product={product} footer={<SiteFooter publicOnly />}>
      <div className="px-8 py-10">
        <h1 className="font-heading text-[2.75rem] font-semibold">Konto bez przypisanego urzędu</h1>
        <p className="mt-4 max-w-prose">
          Konto {account.email} nie ma jeszcze urzędu ani roli. Poproś administratora urzędu o
          nadanie dostępu, a potem zaloguj się ponownie.
        </p>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline" className="font-heading h-11 text-base">
            Wyloguj się
          </Button>
        </form>
      </div>
    </AppShell>
  );
}
