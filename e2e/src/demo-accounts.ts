// Demo data from database/supabase/seed.sql (plan 2). Keep both in sync.
export const DEMO_PASSWORD = 'Haslo-Demo-2026';
export const DEMO_OFFICE_NAME = 'Urząd Ministerstwa Testowego w Kropce Wielkopolskiej';

export const demoAccounts = [
  { role: 'admin', email: 'admin@kropka.test', roleLabel: 'Administrator' },
  { role: 'hr', email: 'kadry@kropka.test', roleLabel: 'Kadry' },
  { role: 'evaluator', email: 'oceniajacy@kropka.test', roleLabel: 'Oceniający' },
] as const;

export type DemoAccount = (typeof demoAccounts)[number];

export function demoAccount(role: string): DemoAccount {
  const account = demoAccounts.find((candidate) => candidate.role === role);
  if (!account) {
    const known = demoAccounts.map((candidate) => candidate.role).join(', ');
    throw new Error(`Unknown demo account role "${role}". Use one of: ${known}`);
  }
  return account;
}
