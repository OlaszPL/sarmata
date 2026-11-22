import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

test.describe('notifications inbox', () => {
  test.describe('evaluator', () => {
    test.beforeEach(async ({ page }) => {
      await signIn(page, demoAccount('evaluator'));
      await page.goto('/powiadomienia');
      await expect(page.getByRole('heading', { level: 1, name: 'Powiadomienia' })).toBeVisible();
    });

    test('lists unread reminders and opens the case', async ({ page }) => {
      await expect(page.getByRole('heading', { level: 2, name: 'Nieprzeczytane' })).toBeVisible();
      const table = page.getByRole('table', { name: 'Nieprzeczytane powiadomienia' });
      await expect(table.getByRole('row', { name: /Ewa Ewidencyjna/ })).toBeVisible();
      await expect(table.getByRole('row', { name: /Marek Merytoryczny/ })).toBeVisible();
      await table.getByRole('link', { name: /Ewa Ewidencyjna/ }).click();
      await expect(page).toHaveURL(/\/oceny\//);
    });

    test('meets WCAG 2.1 AA and does not scroll sideways at 400 px', async ({ page }) => {
      await expectNoViolations(page);
      await page.setViewportSize({ width: 400, height: 800 });
      await expectNoSidewaysScroll(page);
    });

    test('keeps the due date and the action in view at 400 px', async ({ page }) => {
      await page.setViewportSize({ width: 400, height: 800 });
      const list = page.getByRole('list', { name: 'Nieprzeczytane powiadomienia' });
      await expect(list.getByRole('listitem')).toHaveCount(2);
      const inView = (box: { x: number; width: number } | null) => {
        if (box === null) throw new Error('element has no box');
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(400);
      };
      inView(
        await list
          .getByRole('button', { name: /^Oznacz jako przeczytane/ })
          .first()
          .boundingBox(),
      );
      inView(
        await page
          .getByRole('button', { name: 'Oznacz wszystkie jako przeczytane', exact: true })
          .boundingBox(),
      );
    });
  });

  test('hr sees an empty inbox', async ({ page }) => {
    await signIn(page, demoAccount('hr'));
    await page.goto('/powiadomienia');
    await expect(page.getByText('Nie masz powiadomień', { exact: true })).toBeVisible();
  });

  test('admin sees a notice and no table', async ({ page }) => {
    await signIn(page, demoAccount('admin'));
    await page.goto('/powiadomienia');
    await expect(page.getByText('Administrator ich nie dostaje.')).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });
});
