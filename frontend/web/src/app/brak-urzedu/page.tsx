import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AppShell, Button } from '@sarmata/ui';
import { currentAccount } from '@/lib/account';
import { signOut } from '@/lib/auth-actions';
import { product } from '@/lib/product';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Brak urzędu' };

export default async function NoOfficePage() {
  const account = await currentAccount();
  if (account.status === 'signed-out') redirect(routes.signIn);
  if (account.status === 'member') redirect(routes.home);

  return (
    <AppShell productName={product.name} productTagline={product.tagline}>
      <h1 className="text-3xl font-bold">Konto bez przypisanego urzędu</h1>
      <p className="mt-4 max-w-prose">
        Konto {account.email} nie ma jeszcze urzędu ani roli. Poproś administratora urzędu o nadanie
        dostępu, a potem zaloguj się ponownie.
      </p>
      <form action={signOut} className="mt-6">
        <Button type="submit" variant="outline" className="h-11 text-base">
          Wyloguj się
        </Button>
      </form>
    </AppShell>
  );
}
