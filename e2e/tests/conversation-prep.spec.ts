import { expect, test, type Locator, type Page } from '@playwright/test';
import { caseIdOf } from '../src/cases';
import { demoAccount } from '../src/demo-accounts';
import { signIn, signOut } from '../src/session';

// Read-only: never starts a run and never depends on the model output. The panel may hold an
// earlier run of a manual check, so the start button, the progress or the AI-off notice all count.

function prepPanel(page: Page): Locator {
  return page.getByTestId('conversation-prep');
}

/** The panel offers a start, shows a run in progress, or says AI is off in the office. */
async function expectPanelReady(panel: Locator): Promise<void> {
  await expect(
    panel
      .getByTestId('conversation-prep-start')
      .or(panel.getByRole('status'))
      .or(panel.getByText('AI jest wyłączone w ustawieniach urzędu.')),
  ).toBeVisible();
}

async function openCard(page: Page, name: string): Promise<void> {
  await page.goto('/pracownicy');
  await page
    .getByRole('table', { name: 'Lista pracowników' })
    .getByRole('link', { name, exact: true })
    .click();
  await expect(page).toHaveURL(/\/pracownicy\/[0-9a-f-]{36}$/);
}

test.describe('conversation preparation by AI', () => {
  test('the dashboard links to the panel on the card of the evaluator', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await expect(page.getByRole('link', { name: 'Przygotuj rozmowę' })).toHaveAttribute(
      'href',
      /\/pracownicy\/[0-9a-f-]{36}#przygotowanie-rozmowy$/,
    );

    await openCard(page, 'Marek Merytoryczny');
    const panel = prepPanel(page);
    await expect(panel).toHaveAttribute('id', 'przygotowanie-rozmowy');
    await expect(
      panel.getByRole('heading', { level: 2, name: 'Przygotowanie rozmowy bieżącej' }),
    ).toBeVisible();
    await expectPanelReady(panel);
  });

  test('part II of the case offers the evaluation conversation', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    const ewa = await caseIdOf(page, 'Ewa Ewidencyjna');
    await page.goto(`/oceny/${ewa}/czesc-2`);
    const panel = prepPanel(page);
    await expect(
      panel.getByRole('heading', { name: 'Przygotowanie rozmowy oceniającej' }),
    ).toBeVisible();
    await expectPanelReady(panel);
  });

  test('hr sees the panel on the card', async ({ page }) => {
    await signIn(page, demoAccount('hr'));
    await openCard(page, 'Marek Merytoryczny');
    await expectPanelReady(prepPanel(page));
  });

  test('the admin gets no panel and no start button', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    const ewa = await caseIdOf(page, 'Ewa Ewidencyjna');
    await signOut(page);

    await signIn(page, demoAccount('admin'));
    await openCard(page, 'Marek Merytoryczny');
    await expect(page.getByRole('heading', { level: 1, name: 'Marek Merytoryczny' })).toBeVisible();
    await expect(prepPanel(page)).toHaveCount(0);
    await expect(page.getByTestId('conversation-prep-start')).toHaveCount(0);

    await page.goto(`/oceny/${ewa}/czesc-2`);
    await expect(page.getByRole('heading', { level: 1, name: 'Ewa Ewidencyjna' })).toBeVisible();
    await expect(prepPanel(page)).toHaveCount(0);
    await expect(page.getByTestId('conversation-prep-start')).toHaveCount(0);
  });
});
