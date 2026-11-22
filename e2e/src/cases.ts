import { expect, type Page, type Response } from '@playwright/test';

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

/**
 * The response of the next server action call (a POST with the `Next-Action` header), e.g. an
 * autosave, optionally the one whose posted fields contain `text`. Its arrival also proves the page
 * is hydrated, without waiting a fixed time.
 */
export function nextServerAction(page: Page, text?: string): Promise<Response> {
  return page.waitForResponse((response) => {
    const request = response.request();
    return (
      request.method() === 'POST' &&
      'next-action' in request.headers() &&
      (text === undefined || (request.postData() ?? '').includes(text))
    );
  });
}
