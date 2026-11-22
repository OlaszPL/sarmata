import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { signIn } from '../src/session';

// Starts an AI run, so it runs after the read-only specs (project `mutating`). No AI worker runs
// during e2e: the page may wait, show a failure, or show a finished answer.
test.describe('asking the procedure assistant', () => {
  test('shows the question and the state of the answer', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/pomoc');
    await expect(page.getByRole('heading', { level: 1, name: 'Pomoc' })).toBeVisible();
    test.skip(
      await page.getByText('AI jest wyłączone w ustawieniach urzędu.').first().isVisible(),
      'AI is switched off in the office settings',
    );

    await page
      .getByLabel('Twoje pytanie o przepisy')
      .fill('Ile dni ma pracownik na sprzeciw od oceny okresowej?');
    await page.getByRole('button', { name: 'Zadaj pytanie' }).click();

    await expect(page).toHaveURL(/pytanie=/);
    await expect(
      page.getByRole('heading', { level: 3, name: 'Odpowiedź asystenta' }),
    ).toBeVisible();
    await expect(
      page.getByText('Twoje pytanie: „Ile dni ma pracownik na sprzeciw od oceny okresowej?”'),
    ).toBeVisible();

    const waiting = page.getByText('Asystent szuka odpowiedzi w przepisach.');
    const failed = page.getByText(/Asystent nie odpowiedział|AI jest wyłączone|odpowiada dłużej/);
    const done = page.getByText('Sugestia AI. Decyzję podejmujesz Ty.');
    await expect(waiting.or(failed).or(done).first()).toBeVisible();
  });
});
