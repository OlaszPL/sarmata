import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

test('marks notifications as read and updates the bell', async ({ page }) => {
  await signIn(page, demoAccount('evaluator'));
  await page.goto('/powiadomienia');
  const bell = page.getByRole('link', { name: /^Powiadomienia, nieprzeczytane: \d+$/ });
  const label = (await bell.getAttribute('aria-label')) ?? '';
  const before = Number(/(\d+)$/.exec(label)?.[1] ?? 0);
  expect(
    before,
    `bell says "${label}", expected at least one unread notification`,
  ).toBeGreaterThanOrEqual(1);

  await page
    .getByRole('button', { name: /^Oznacz jako przeczytane/ })
    .first()
    .click();
  await expect(page.getByRole('status')).toContainText('Oznaczono jako przeczytane.');
  await expect(
    page.getByRole('link', { name: `Powiadomienia, nieprzeczytane: ${before - 1}` }),
  ).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: 'Przeczytane' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Przeczytane powiadomienia' })).toBeVisible();

  if (before > 1) {
    await page.getByRole('button', { name: 'Oznacz wszystkie jako przeczytane' }).click();
    await expect(page.getByRole('status')).toContainText('Oznaczono wszystkie jako przeczytane.');
  }
  await expect(page.getByRole('link', { name: 'Powiadomienia, nieprzeczytane: 0' })).toBeVisible();
  await expect(page.getByRole('banner').getByText(/^\d+$/)).toHaveCount(0);
});
