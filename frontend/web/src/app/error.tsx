'use client';

import { AppShell, Button } from '@sarmata/ui';
import { SiteFooter } from '@/components/shell/site-footer';
import { product } from '@/lib/product';

/** Polish error page for failures of a route, e.g. a broken account contract or missing config. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <AppShell product={product} footer={<SiteFooter />}>
      <div className="px-8 py-10">
        <h1 className="font-heading text-[2.75rem] font-semibold">Coś poszło nie tak</h1>
        <p className="mt-4 max-w-prose">
          Nie udało się wyświetlić tej strony. Spróbuj ponownie. Jeśli błąd się powtarza, zgłoś go
          administratorowi.
        </p>
        <Button type="button" className="mt-6 h-11 text-base" onClick={reset}>
          Spróbuj ponownie
        </Button>
      </div>
    </AppShell>
  );
}
