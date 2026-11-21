import '@fontsource-variable/open-sans';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import './globals.css';
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { product } from '@/lib/product';

export const metadata: Metadata = {
  title: { default: product.name, template: `%s | ${product.name}` },
  description: 'Cyfrowy asystent ocen okresowych w służbie cywilnej',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
