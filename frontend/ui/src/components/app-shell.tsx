import type { ReactNode } from 'react';
import { BrandMark } from '#components/brand-mark';

interface AppShellProps {
  product: { readonly name: string; readonly tagline: string };
  homeHref?: string;
  /** Main navigation. Shown in the header row from `lg`, in its own scrolling row below. */
  nav?: ReactNode;
  /** Header cells between the filler and the primary action: search, accessibility tools, account. */
  tools?: ReactNode;
  /** Full-height block at the right end of the header. */
  primaryAction?: ReactNode;
  /** Content of the footer band. */
  footer?: ReactNode;
  children: ReactNode;
}

/** Page frame in a grid of 1 px lines: skip link, header cells, main landmark with rails, footer. */
export function AppShell({
  product,
  homeHref = '/',
  nav,
  tools,
  primaryAction,
  footer,
  children,
}: AppShellProps) {
  return (
    <div className="flex min-h-dvh flex-col bg-white">
      <a
        href="#main"
        className="font-heading bg-navy sr-only font-medium text-white focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2"
      >
        Przejdź do treści
      </a>
      <header className="border-rule border-b">
        <div className="flex min-h-16 items-stretch">
          <a
            href={homeHref}
            className="bg-navy flex shrink-0 items-center gap-3 px-6 text-white no-underline"
          >
            <span className="flex size-10 items-center justify-center bg-white">
              <BrandMark className="size-8" />
            </span>
            <span className="font-heading text-2xl font-bold">{product.name}</span>
            <span className="sr-only">: {product.tagline}</span>
          </a>
          {nav ? <div className="hidden lg:flex">{nav}</div> : null}
          <div className="flex-1" />
          {tools ? <div className="flex items-stretch">{tools}</div> : null}
          {primaryAction}
        </div>
        {nav ? (
          <div className="border-rule overflow-x-auto border-t lg:hidden">
            <div className="flex min-w-max">{nav}</div>
          </div>
        ) : null}
      </header>
      <div className="flex-1 px-8">
        <main
          id="main"
          tabIndex={-1}
          className="border-rule mx-auto h-full w-full max-w-[90rem] border-x outline-none"
        >
          {children}
        </main>
      </div>
      <div className="bg-brand-red h-1" aria-hidden />
      <div className="bg-navy-dark text-white">{footer}</div>
    </div>
  );
}
