import type { Metadata } from 'next';
import { AppShell, Card, CardContent, CardDescription, CardHeader } from '@sarmata/ui';
import { product } from '@/lib/product';
import { LoginForm } from './login-form';

export const metadata: Metadata = { title: 'Logowanie' };

export default function SignInPage() {
  return (
    <AppShell product={product}>
      <div className="mx-auto max-w-md">
        <Card>
          <CardHeader>
            <h1 className="text-2xl font-bold">Zaloguj się</h1>
            <CardDescription className="text-base">
              Użyj adresu e-mail i hasła konta w aplikacji urzędu.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm />
          </CardContent>
        </Card>
      </div>
    </AppShell>
  );
}
