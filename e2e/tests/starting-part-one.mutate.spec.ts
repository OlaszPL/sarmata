import { expect, test, type Page } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

// The seed holds no case in part I, so this file starts one for Jan, who no other spec uses. It
// sorts after the other mutating files, so their dashboards never see the extra case.
test.describe.serial('part I of a new evaluation of Jan', () => {
  let page: Page;

  test.beforeAll(async ({ browser }) => {
    page = await (await browser.newContext()).newPage();
    await signIn(page, demoAccount('evaluator'));
  });

  test.afterAll(async () => {
    await page.context().close();
  });

  test('starts the evaluation', async () => {
    await page.goto('/oceny/nowa');
    await page.getByRole('radio', { name: /Jan Odwoławczy/ }).check();
    await page.getByRole('button', { name: 'Dalej' }).click();
    await page.getByRole('button', { name: 'Rozpocznij ocenę' }).click();
    await expect(page).toHaveURL(/\/oceny\/[0-9a-f-]{36}\/czesc-1$/);
    await expect(page.getByRole('button', { name: 'Zatwierdź część I' })).toBeVisible();
  });

  test('Enter in a one-line field does not approve part I', async () => {
    const posts: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && 'next-action' in request.headers()) {
        posts.push(request.postData() ?? '');
      }
    });
    const place = page.getByLabel('Miejscowość');
    await place.fill('Kropka');
    await place.press('Enter');
    await page.getByLabel('Data rozmowy rozpoczynającej').press('Enter');
    // An implicit submit would post at once. Give it time to show up before checking.
    await page.waitForTimeout(1500);
    expect(posts.filter((body) => body.includes('approve'))).toEqual([]);
    await expect(page.getByRole('button', { name: 'Zatwierdź część I' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Odnotuj podpis części I' })).toHaveCount(0);
  });

  test('criteria proposals ask for the duties first', async () => {
    const panel = page.getByRole('region', { name: 'Propozycje kryteriów od AI' });
    await expect(panel).toBeVisible();
    await panel.getByRole('button', { name: 'Zaproponuj kryteria' }).click();
    await expect(panel.getByText('Opisz obowiązki, zanim poprosisz o propozycje.')).toBeVisible();
    await expectNoViolations(page);
  });

  test('criteria proposals start from the duties', async () => {
    const panel = page.getByRole('region', { name: 'Propozycje kryteriów od AI' });
    await panel
      .getByLabel('Obowiązki na stanowisku')
      .fill(
        'Prowadzi postępowania odwoławcze, przygotowuje projekty decyzji i odpowiada klientom.',
      );
    await panel.getByRole('button', { name: 'Zaproponuj kryteria' }).click();
    // Queued, running, done or failed: the model is not part of this test.
    await expect(
      panel
        .getByText(
          /Prośba czeka w kolejce|AI przygotowuje propozycje|AI proponuje|AI nie proponuje|Nie udało się|wyłączone/,
        )
        .first(),
    ).toBeVisible();
    // Part I stays open: the proposals never approve it.
    await expect(page.getByRole('button', { name: 'Zatwierdź część I' })).toBeVisible();
  });
});
