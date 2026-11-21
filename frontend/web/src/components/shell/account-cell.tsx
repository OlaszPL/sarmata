import type { MemberAccount } from '@sarmata/services';
import { officeEmployees } from '@/lib/account';
import { signOut } from '@/lib/auth-actions';
import { roleLabels } from '@/lib/role-labels';

async function displayName(account: MemberAccount): Promise<string> {
  try {
    const employee = (await officeEmployees()).find((e) => e.userId === account.userId);
    if (employee) return `${employee.firstName} ${employee.lastName}`;
  } catch {
    // The header still works with the e-mail when the list cannot be loaded.
  }
  return account.email;
}

/** Name, role and office of the signed-in account with the sign-out button. */
export async function AccountCell({ account }: { account: MemberAccount }) {
  const name = await displayName(account);

  return (
    <div className="border-rule flex items-center gap-4 border-l px-5">
      <div className="max-w-72 py-2">
        <p className="font-heading truncate font-medium">{name}</p>
        <p className="text-ink-muted truncate text-sm">
          {roleLabels[account.role]}, {account.office.name}
        </p>
      </div>
      <form action={signOut}>
        <button
          type="submit"
          className="font-heading text-link hover:text-navy-dark text-sm font-medium underline"
        >
          Wyloguj się
        </button>
      </form>
    </div>
  );
}
