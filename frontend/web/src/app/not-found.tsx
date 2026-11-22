import { AppShell } from '@sarmata/ui';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteFooter } from '@/components/shell/site-footer';
import { product } from '@/lib/product';
import { routes } from '@/lib/routes';

export const metadata: Metadata = { title: 'Nie znaleziono strony' };

/**
 * Polish page for every `notFound()` and unknown address, e.g. a case link from before a database
 * reset, which gives the demo evaluations new ids.
 */
export default function NotFound() {
  return (
    <AppShell product={product} footer={<SiteFooter />}>
      <div className="px-8 py-10">
        <h1 className="font-heading text-[2.75rem] font-semibold">Nie znaleziono strony</h1>
        <p className="mt-4">
          Pod tym adresem nie ma strony. Link mógł być nieaktualny albo dane zostały usunięte.
        </p>
        <p className="mt-6">
          <Link href={routes.home} className="font-heading text-link font-medium underline">
            Przejdź do pulpitu
          </Link>
        </p>
      </div>
    </AppShell>
  );
}
