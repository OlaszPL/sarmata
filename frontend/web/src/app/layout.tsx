import '@fontsource-variable/open-sans';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import './globals.css';
import type { Metadata } from 'next';
import Script from 'next/script';
import type { ReactNode } from 'react';
import { applySavedA11ySettings } from '@/lib/a11y-settings';
import { product } from '@/lib/product';

export const metadata: Metadata = {
  title: { default: product.name, template: `%s | ${product.name}` },
  description: 'Cyfrowy asystent ocen okresowych w służbie cywilnej',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    // The head script sets data attributes before hydration, React must not complain about them.
    <html lang="pl" suppressHydrationWarning>
      <body>
        <Script id="a11y-settings" strategy="beforeInteractive">
          {applySavedA11ySettings}
        </Script>
        {children}
      </body>
    </html>
  );
}
