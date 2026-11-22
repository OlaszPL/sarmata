import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { expect, test } from '@playwright/test';
import { demoAccount } from '../src/demo-accounts';
import { expectNoSidewaysScroll, expectNoViolations } from '../src/page-checks';
import { signIn } from '../src/session';

const FIXTURE = path.join(import.meta.dirname, '..', 'fixtures', 'import-small.csv');

const routes = [
  { path: '/kadry', title: 'Kadry' },
  { path: '/kadry/harmonogram', title: 'Harmonogram ocen' },
  { path: '/kadry/statystyki', title: 'Statystyki ocen' },
  { path: '/kadry/rejestr', title: 'Rejestr kadr' },
  { path: '/kadry/import', title: 'Import pracowników' },
  { path: '/kadry/struktura', title: 'Struktura przełożonych' },
];

const warsawYear = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Warsaw', year: 'numeric' }).format(
    new Date(),
  );

test.describe('hr panel as hr', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, demoAccount('hr'));
  });

  for (const route of routes) {
    test(`${route.path} has its heading and meets WCAG 2.1 AA`, async ({ page }) => {
      await page.goto(route.path);
      await expect(
        page.getByRole('heading', { level: 1, name: route.title, exact: true }),
      ).toBeVisible();
      await expectNoViolations(page);
    });
  }

  for (const route of ['/kadry/harmonogram', '/kadry/statystyki', '/kadry/rejestr']) {
    test(`${route} fits a narrow screen`, async ({ page }) => {
      await page.goto(route);
      await page.setViewportSize({ width: 400, height: 900 });
      await expectNoSidewaysScroll(page);
    });
  }

  test('the task list asks to decide the objection of Stefan', async ({ page }) => {
    await page.goto('/kadry');
    const table = page.getByRole('table', { name: 'Zadania kadr' });
    const row = table.getByRole('row', { name: /Stefan Sprzeciwny/ });
    await expect(row.getByText('Rozstrzygnij sprzeciw')).toBeVisible();
  });

  test('the schedule filter by situation reports the count', async ({ page }) => {
    await page.goto('/kadry/harmonogram');
    await page.getByLabel('Sytuacja').selectOption({ label: 'Po terminie' });
    await page.getByRole('button', { name: 'Pokaż harmonogram' }).click();
    await expect(page).toHaveURL(/flaga=po-terminie/);
    await expect(page.getByRole('status').filter({ hasText: /\d+ ocen/ })).toBeVisible();
  });

  test('the statistics offer the DSC-OCK file with a BOM', async ({ page }) => {
    await page.goto('/kadry/statystyki');
    const link = page.getByRole('link', { name: 'Pobierz CSV do sprawozdania DSC-OCK' });
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    expect(download.suggestedFilename()).toBe(`dsc-ock-${warsawYear()}.csv`);
    const content = await readFile(await download.path(), 'utf8');
    expect(content.startsWith('﻿pytanie;opis;wartosc')).toBe(true);
  });

  test('the statistics show the evaluator report to hr', async ({ page }) => {
    await page.goto('/kadry/statystyki');
    await expect(page.getByRole('table', { name: 'Oceniający i ich oceny' })).toBeVisible();
  });

  test('a year without evaluations shows an empty state', async ({ page }) => {
    await page.goto('/kadry/statystyki?rok=2001');
    await expect(page.getByText('Brak ocen w 2001 r.')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the import dry run labels every row and writes nothing', async ({ page }) => {
    await page.goto('/kadry/import');
    await page.getByLabel('Plik z listą pracowników').setInputFiles(FIXTURE);
    await page.getByRole('button', { name: 'Sprawdź kolumny' }).click();
    await expect(page.getByRole('heading', { level: 2, name: 'Dopasowanie kolumn' })).toBeVisible();
    await page.getByRole('button', { name: 'Wykonaj przebieg próbny' }).click();

    const table = page.getByRole('table', { name: 'Wynik przebiegu próbnego' });
    await expect(table.getByText('Nowy pracownik')).toBeVisible();
    await expect(table.getByText('Błąd', { exact: true })).toBeVisible();
    await expect(table.getByText('Wymaga decyzji')).toBeVisible();
    await expect(
      table.getByText('Data nawiązania stosunku pracy: nieprawidłowa data'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Zaimportuj pracowników' })).toBeVisible();
    await expectNoViolations(page);

    await page.goto('/kadry/struktura');
    await expect(page.getByText('Nina Nowicka')).toHaveCount(0);
  });

  test('the register shows the recorded appeal of Olga', async ({ page }) => {
    await page.goto('/kadry/rejestr');
    const table = page.getByRole('table', { name: 'Sprawy z nieuwzględnionym sprzeciwem' });
    const row = table.getByRole('row', { name: /Olga Oceniająca/ });
    await expect(row).toBeVisible();
    await expect(row.getByText('Brak wpisu')).toHaveCount(0);
  });
});

test.describe('hr panel as other roles', () => {
  test('the evaluator gets a notice in the register', async ({ page }) => {
    await signIn(page, demoAccount('evaluator'));
    await page.goto('/kadry/rejestr');
    await expect(page.getByText('Ta część jest dla kadr')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the admin gets a notice in the import', async ({ page }) => {
    await signIn(page, demoAccount('admin'));
    await page.goto('/kadry/import');
    await expect(page.getByText('Ta część jest dla kadr')).toBeVisible();
    await expectNoViolations(page);
  });

  test('the admin reads the office statistics but not the evaluator report', async ({ page }) => {
    await signIn(page, demoAccount('admin'));
    await page.goto('/kadry/statystyki');
    await expect(
      page.getByRole('heading', { level: 2, name: 'Rozkład ocen na tle kraju' }),
    ).toBeVisible();
    await expect(page.getByRole('table', { name: 'Oceniający i ich oceny' })).toHaveCount(0);
    await expect(page.getByText('Ta część jest dla kadr')).toBeVisible();
    await expectNoViolations(page);
  });
});
