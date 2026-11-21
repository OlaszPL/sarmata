import type { ReactNode } from 'react';
import { BrandMark } from '#components/brand-mark';

interface AppShellProps {
  product: { readonly name: string; readonly tagline: string };
  /** Right side of the header, e.g. the signed-in account and the sign-out button. */
  account?: ReactNode;
  children: ReactNode;
}

/** Page frame: skip link, header with the product name and the main landmark. */
export function AppShell({ product, account, children }: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-background focus:px-4 focus:py-2"
      >
        Przejdź do treści
      </a>
      <header className="border-b-4 border-primary bg-background">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-3">
            <BrandMark className="size-10 shrink-0" />
            <div>
              <p className="text-lg leading-tight font-bold">{product.name}</p>
              <p className="text-sm text-muted-foreground">{product.tagline}</p>
            </div>
          </div>
          {account}
        </div>
      </header>
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {children}
      </main>
    </div>
  );
}
