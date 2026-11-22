import { expect, test, type Page } from '@playwright/test';
import { draftedEvaluationOf, isoDaysFromToday } from '../src/case-state';
import { demoAccount } from '../src/demo-accounts';
import { errorSummary } from '../src/page-checks';
import { signIn } from '../src/session';

/** `2026-11-22` as `22.11.2026`. */
function polishDate(iso: string): string {
  const [year, month, day] = iso.split('-') as [string, string, string];
  return `${day}.${month}.${year}`;
}

async function waitForEvents(page: Page): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 2, name: 'Zapoznanie i sprzeciw' }),
  ).toBeVisible();
}

async function openEventsOf(page: Page, name: string): Promise<void> {
  await page.goto('/oceny');
  await page.getByRole('main').getByRole('link', { name }).first().click();
  await expect(page).toHaveURL(/\/oceny\/[0-9a-f-]{36}$/);
  await page.goto(`${new URL(page.url()).pathname}/zdarzenia`);
  await waitForEvents(page);
}

/** The side events table row that holds the text. */
function sideRow(page: Page, text: string | RegExp) {
  return page
    .getByRole('table', { name: 'Zdarzenia boczne tej oceny' })
    .getByRole('row')
    .filter({ hasText: text });
}

// These tests change the demo data and depend on each other, so they run in order.
test.describe.serial('events tab changes', () => {
  test('hr decides the objection of Stefan', async ({ page }) => {
    await signIn(page, demoAccount('hr'));
    await openEventsOf(page, 'Stefan Sprzeciwny');
    const main = page.getByRole('main');
    const decision = page.locator('form', { has: page.locator('#decision-outcome') });

    await decision.getByRole('button', { name: 'Zapisz wynik sprzeciwu' }).click();
    const missing = errorSummary(page, 'Popraw wynik sprzeciwu');
    await expect(missing).toBeFocused();
    await expect(missing.getByRole('link').first()).toHaveAttribute('href', '#decision-outcome');

    await decision.getByRole('radio', { name: /^Zmiana oceny/ }).check();
    const groups = decision.getByRole('radiogroup');
    const count = await groups.count();
    expect(count).toBeGreaterThan(0);
    await groups.first().locator('input[value="1"]').check({ force: true });
    await decision.getByRole('button', { name: 'Zapisz wynik sprzeciwu' }).click();
    await expect(
      errorSummary(page, 'Popraw wynik sprzeciwu').getByText(
        'Rozpatrzenie sprzeciwu nie może obniżyć oceny',
      ),
    ).toBeVisible();
    await expect(decision.locator('input[name^="rating-"]:checked')).toHaveCount(count);
    await expect(
      decision.getByRole('radiogroup').first().locator('input[value="1"]'),
    ).toBeChecked();

    await decision.getByRole('radio', { name: /^Sprzeciw nieuwzględniony/ }).check();
    await decision.getByRole('button', { name: 'Zapisz wynik sprzeciwu' }).click();
    await expect(main.getByRole('status')).toContainText('Zapisano wynik rozpatrzenia sprzeciwu');
    await expect(main.getByText('Sprzeciw rozpatrzono')).toBeVisible();
    await expect(main.getByText('Sprzeciw nieuwzględniony').first()).toBeVisible();
    await expect(main).toContainText(/Odwołanie do sądu pracy\s*do \d{2}\.\d{2}\.\d{4}/);
  });

  test('Ewa: refusal of the signature, early closing refused, then closed', async ({ page }) => {
    const evaluationId = await draftedEvaluationOf('ewa.ewidencyjna@kropka.test');
    await signIn(page, demoAccount('evaluator'));
    await page.goto(`/oceny/${evaluationId}/zdarzenia`);
    await waitForEvents(page);
    const main = page.getByRole('main');

    await main.getByLabel('Data zapoznania osoby ocenianej z oceną').fill(isoDaysFromToday(-10));
    await main.getByRole('radio', { name: /^Nie, osoba oceniana odmówiła podpisu/ }).check();
    await main.locator('#acquaintance-witnesses').fill('Jan Kowalski\nAnna Nowak');
    await main.getByRole('button', { name: 'Odnotuj zapoznanie' }).click();
    await expect(main.getByRole('status')).toContainText('Odnotowano zapoznanie z oceną');
    await expect(main.getByText('Osoba oceniana odmówiła podpisu')).toBeVisible();
    await expect(main.getByText('Jan Kowalski')).toBeVisible();
    await expect(main.getByText('Anna Nowak')).toBeVisible();

    await main.locator('#closing-closedOn').fill(isoDaysFromToday(-5));
    await main.getByRole('button', { name: 'Zamknij ocenę' }).click();
    const early = errorSummary(page, 'Popraw zamknięcie oceny');
    await expect(early).toBeFocused();
    await expect(
      early.getByRole('link', { name: /Termin na sprzeciw jeszcze trwa/ }),
    ).toHaveAttribute('href', '#closing-closedOn');

    await main.locator('#closing-closedOn').fill(isoDaysFromToday(0));
    await main.getByRole('button', { name: 'Zamknij ocenę' }).click();
    await expect(main.getByRole('status')).toContainText('Ocena została zamknięta.');
  });

  test('Marek: absence and return, term change refused, position change', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await openEventsOf(page, 'Marek Merytoryczny');
    const main = page.getByRole('main');
    const absenceFrom = isoDaysFromToday(-20);
    const returnOn = isoDaysFromToday(-15);

    await main.locator('summary', { hasText: 'Odnotuj nieobecność' }).click();
    await main.locator('#absence-from').fill(absenceFrom);
    await main.getByRole('button', { name: 'Odnotuj nieobecność' }).click();
    await expect(main.getByRole('status')).toContainText('Zapisano nieobecność');
    await expect(sideRow(page, `od ${polishDate(absenceFrom)}, trwa`)).toBeVisible();

    await main.locator('summary', { hasText: /^Odnotuj powrót z nieobecności od/ }).click();
    await main.locator('input[id^="return-"][id$="-to"]').fill(returnOn);
    await main.getByRole('button', { name: 'Odnotuj powrót' }).click();
    await expect(main.getByRole('status')).toContainText('Zapisano powrót z nieobecności');
    await expect(
      sideRow(page, `od ${polishDate(absenceFrom)} do ${polishDate(returnOn)}`),
    ).toBeVisible();

    await main.locator('summary', { hasText: 'Zmień termin oceny' }).click();
    await main.locator('#term-newDueOn').fill(isoDaysFromToday(60));
    await main.getByRole('radio', { name: 'Wniosek osoby ocenianej' }).check();
    await main.locator('#term-noticeOn').fill(isoDaysFromToday(0));
    await main.getByRole('button', { name: 'Zmień termin oceny' }).click();
    const term = errorSummary(page, 'Popraw zmianę terminu');
    await expect(term).toBeFocused();
    await expect(term.getByRole('link').first()).toHaveAttribute('href', '#term-noticeOn');
    await expect(page.locator('details', { has: page.locator('#term-noticeOn') })).toHaveAttribute(
      'open',
      '',
    );

    await main.locator('summary', { hasText: 'Odnotuj zmianę stanowiska' }).click();
    await main.locator('#position-changedOn').fill(isoDaysFromToday(0));
    await main.locator('#position-positionTitle').fill('Specjalista ds. testów');
    await main.getByRole('radio', { name: /^Nie, obowiązki zmieniły się nieistotnie/ }).check();
    await main.getByRole('button', { name: 'Odnotuj zmianę stanowiska' }).click();
    const position = errorSummary(page, 'Popraw zmianę stanowiska');
    await expect(position.getByRole('link').first()).toHaveAttribute(
      'href',
      '#position-justification',
    );

    await main.locator('#position-justification').fill('Przeniesienie do zespołu jakości.');
    await main.getByRole('button', { name: 'Odnotuj zmianę stanowiska' }).click();
    await expect(main.getByRole('status')).toContainText('Zapisano zmianę stanowiska');
    await expect(sideRow(page, 'Specjalista ds. testów')).toBeVisible();
  });
});
