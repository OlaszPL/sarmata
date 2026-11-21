import type { Metadata } from 'next';
import { AppShell } from '@sarmata/ui';
import { SiteFooter } from '@/components/shell/site-footer';
import { product } from '@/lib/product';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Logowanie' };

export default function SignInPage() {
  return (
    <AppShell product={product} footer={<SiteFooter publicOnly />}>
      <div className="flex flex-1 items-start justify-center px-4 py-16 sm:px-8">
        <section
          aria-labelledby="sign-in-title"
          className="border-rule w-full max-w-[36rem] border bg-white"
        >
          <div className="border-rule bg-navy border-b px-10 py-8 text-white">
            <h1
              id="sign-in-title"
              className="font-heading text-[2.25rem] leading-tight font-semibold tracking-tight"
            >
              Zaloguj się
            </h1>
            <p className="text-on-navy-muted mt-2 text-base">
              Użyj adresu e-mail i hasła konta w aplikacji urzędu.
            </p>
          </div>
          <div className="px-10 py-8">
            <LoginForm />
          </div>
        </section>
      </div>
    </AppShell>
  );
}
