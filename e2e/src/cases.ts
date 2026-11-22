import { expect, type Page } from '@playwright/test';

/** Id of the case of an employee, read from the "Zrób teraz" region of the evaluator dashboard. */
export async function caseIdOf(page: Page, employeeName: string): Promise<string> {
  const href = await page
    .getByRole('region', { name: 'Zrób teraz' })
    .getByRole('link', { name: new RegExp(employeeName) })
    .getAttribute('href');
  const match = /\/oceny\/([0-9a-f-]{36})$/.exec(href ?? '');
  expect(match, `case link of ${employeeName}`).not.toBeNull();
  return match?.[1] ?? '';
}
