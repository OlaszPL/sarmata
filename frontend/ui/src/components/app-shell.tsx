import type { ReactNode } from 'react';
import { BrandMark } from '#components/brand-mark';

interface AppShellProps {
  product: { readonly name: string; readonly tagline: string };
  homeHref?: string;
  /** Main navigation. Shown in the header row from `xl`, in its own scrolling row below. */
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
        {/*
          From `xl` (1280px) everything sits on one line and the tools shrink (the account cell
          truncates). Below, cells wrap onto a second line when they do not fit. Cells of the first
          line draw the line between the two, the row overlaps the header border by 1px so a single
          line stays single.
        */}
        <div className="-mb-px flex flex-wrap items-stretch xl:flex-nowrap">
          <a
            href={homeHref}
            className="bg-navy border-rule flex min-h-16 shrink-0 items-center gap-3 border-b px-6 text-white no-underline"
          >
            <span className="flex size-10 items-center justify-center bg-white">
              <BrandMark className="size-10" />
            </span>
            <span className="font-heading text-2xl leading-[normal] font-bold tracking-[-0.0125em]">
              {product.name}
            </span>
            <span className="sr-only">: {product.tagline}</span>
          </a>
          {nav ? <div className="border-rule hidden shrink-0 border-b xl:flex">{nav}</div> : null}
          <div className="border-rule flex-1 border-b" />
          {/* -ml-px: when the filler shrinks to nothing, the first tool line lies on the last nav line. */}
          <div className="-ml-px flex min-h-16 min-w-0 grow items-stretch justify-end">
            {tools}
            {primaryAction}
          </div>
        </div>
        {nav ? (
          <div className="border-rule focus-inset overflow-x-auto border-t xl:hidden">
            <div className="flex min-w-max">{nav}</div>
          </div>
        ) : null}
      </header>
      {/* A flex column all the way down, so the rails reach the footer on a short page. */}
      <div className="flex flex-1 flex-col px-8">
        <main
          id="main"
          tabIndex={-1}
          className="border-rule mx-auto flex w-full max-w-[75rem] flex-1 flex-col border-x outline-none"
        >
          {children}
        </main>
      </div>
      <div className="bg-brand-red h-1" aria-hidden />
      <div className="bg-navy-dark text-white">{footer}</div>
    </div>
  );
}
