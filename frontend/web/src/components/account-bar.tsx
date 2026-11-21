import { LogOut } from 'lucide-react';
import { Badge, Button } from '@sarmata/ui';
import type { MemberAccount } from '@sarmata/services';
import { signOut } from '@/lib/auth-actions';
import { roleLabels } from '@/lib/role-labels';

/** Office, account and role from the JWT claims, with the sign-out button. */
export function AccountBar({ account }: { account: MemberAccount }) {
  return (
    <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
      <div className="text-sm">
        <p className="font-semibold">{account.office.name}</p>
        <p className="flex flex-wrap items-center gap-2 text-muted-foreground">
          <span>{account.email}</span>
          <Badge variant="secondary">
            <span className="sr-only">Rola: </span>
            {roleLabels[account.role]}
          </Badge>
        </p>
      </div>
      <form action={signOut}>
        <Button type="submit" variant="outline" className="h-11 text-base">
          <LogOut aria-hidden />
          Wyloguj się
        </Button>
      </form>
    </div>
  );
}
