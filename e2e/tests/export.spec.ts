import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { evaluationsOf } from '../src/evaluations';
import { signIn } from '../src/session';

const evaluator = demoAccount('evaluator');

async function anEvaluation(status?: string) {
  const evaluations = await evaluationsOf(evaluator.email);
  const found =
    status === undefined ? evaluations[0] : evaluations.find((e) => e.status === status);
  if (found === undefined) throw new Error(`No demo evaluation${status ? ` in ${status}` : ''}`);
  return found.id;
}

test.describe('exports', () => {
  test('sheet pdf downloads', async ({ page }) => {
    await signIn(page, evaluator);
    const id = await anEvaluation();
    const response = await page.request.get(`/api/oceny/${id}/eksport/arkusz-pdf`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/pdf');
    expect(response.headers()['cache-control']).toBe('no-store');
    expect((await response.body()).subarray(0, 4).toString()).toBe('%PDF');
  });

  test('sheet docx downloads', async ({ page }) => {
    await signIn(page, evaluator);
    const id = await anEvaluation();
    const response = await page.request.get(`/api/oceny/${id}/eksport/arkusz-docx?podpis=1`);
    expect(response.status()).toBe(200);
    expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
  });

  test('case file downloads as zip', async ({ page }) => {
    await signIn(page, evaluator);
    const id = await anEvaluation();
    const response = await page.request.get(`/api/oceny/${id}/eksport/teczka`);
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/zip');
    expect((await response.body()).subarray(0, 2).toString()).toBe('PK');
  });

  test('filename keeps Polish letters in filename*', async ({ page }) => {
    await signIn(page, evaluator);
    const id = await anEvaluation();
    const response = await page.request.get(`/api/oceny/${id}/eksport/arkusz-pdf`);
    const disposition = response.headers()['content-disposition'] ?? '';
    expect(disposition).toMatch(
      /^attachment; filename="[\x20-\x7e]+\.pdf"; filename\*=UTF-8''.+\.pdf$/,
    );
    const ascii = /filename="([^"]+)"/.exec(disposition)?.[1] ?? '';
    const encoded = /filename\*=UTF-8''(.+)$/.exec(disposition)?.[1] ?? '';
    expect(decodeURIComponent(encoded).startsWith('arkusz-')).toBe(true);
    expect(ascii.startsWith('arkusz-')).toBe(true);
  });

  test('ezd package of an open evaluation returns 409', async ({ page }) => {
    await signIn(page, evaluator);
    const id = await anEvaluation('period');
    const response = await page.request.get(`/api/oceny/${id}/eksport/paczka-ezd?znak=DOA.1`);
    expect(response.status()).toBe(409);
    expect(await response.json()).toEqual({ error: 'not_exportable' });
  });

  test('bad kind returns 400 and unknown evaluation 404', async ({ page }) => {
    await signIn(page, evaluator);
    const id = await anEvaluation();
    expect((await page.request.get(`/api/oceny/${id}/eksport/nieznany`)).status()).toBe(400);
    const missing = '00000000-0000-4000-8000-000000000000';
    expect((await page.request.get(`/api/oceny/${missing}/eksport/arkusz-pdf`)).status()).toBe(404);
  });

  test('signed-out request returns 401', async ({ request }) => {
    const missing = '00000000-0000-4000-8000-000000000000';
    const response = await request.get(`/api/oceny/${missing}/eksport/arkusz-pdf`);
    expect(response.status()).toBe(401);
  });
});
