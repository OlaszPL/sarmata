import type { MemberAccount } from '@sarmata/services';
import { officeEmployees } from '@/lib/account';
import { roleLabels } from '@/lib/role-labels';
import { AccountMenu } from './account-menu';

async function displayName(account: MemberAccount): Promise<string> {
  try {
    const employee = (await officeEmployees()).find((e) => e.userId === account.userId);
    if (employee) return `${employee.firstName} ${employee.lastName}`;
  } catch {
    // The header still works with the e-mail when the list cannot be loaded.
  }
  return account.email;
}

/** Name, role and office of the signed-in account, with sign-out in its menu. */
export async function AccountCell({ account }: { account: MemberAccount }) {
  const name = await displayName(account);
  return (
    <AccountMenu name={name} details={`${roleLabels[account.role]}, ${account.office.name}`} />
  );
}
