// Walkthrough for agents (.claude/skills/app-walkthrough/SKILL.md): signs in as each requested demo
// account, opens each path and saves full-page screenshots. Driven by environment variables:
//   WALK_ACCOUNTS  comma-separated roles: admin, hr, evaluator (default: all)
//   WALK_PATHS     comma-separated paths (default: /)
//   WALK_OUT       output directory (default: e2e/.screenshots)
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { demoAccount, demoAccounts, type DemoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

const outDir = process.env.WALK_OUT ?? path.join(import.meta.dirname, '..', '.screenshots');
const accounts: DemoAccount[] = process.env.WALK_ACCOUNTS
  ? process.env.WALK_ACCOUNTS.split(',').map((role) => demoAccount(role.trim()))
  : [...demoAccounts];
const paths = process.env.WALK_PATHS
  ? process.env.WALK_PATHS.split(',').map((route) => route.trim())
  : ['/'];

function screenshotName(route: string): string {
  const slug = route.replace(/^\/+|\/+$/g, '').replace(/[^\p{L}\p{N}]+/gu, '-');
  return `${slug || 'start'}.png`;
}

test('sign-in page', async ({ page }) => {
  await page.goto('/logowanie');
  const file = path.join(outDir, 'logowanie.png');
  await page.screenshot({ path: file, fullPage: true });
  console.log(`[walk] /logowanie -> ${file}`);
});

for (const account of accounts) {
  test(`as ${account.role}`, async ({ page }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (message.type() === 'error') problems.push(`console error: ${message.text()}`);
    });
    page.on('pageerror', (error) => problems.push(`page error: ${error.message}`));

    await signIn(page, account);
    for (const route of paths) {
      const response = await page.goto(route);
      await page.waitForLoadState('networkidle');
      const file = path.join(outDir, account.role, screenshotName(route));
      await page.screenshot({ path: file, fullPage: true });
      console.log(`[walk] ${account.role} ${route} -> ${file} (HTTP ${response?.status() ?? '?'})`);
    }

    for (const problem of problems) console.log(`[walk] ${account.role} ${problem}`);
    expect(problems, 'browser errors during the walk').toEqual([]);
  });
}
