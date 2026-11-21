import { defineConfig, devices } from '@playwright/test';
import { taskPort } from '../scripts/task-port.mjs';

const ci = Boolean(process.env.CI);
const port = taskPort();
const baseURL = `http://localhost:${port}`;

export default defineConfig({
  outputDir: 'test-results',
  forbidOnly: ci,
  retries: ci ? 1 : 0,
  workers: ci ? 2 : undefined,
  reporter: ci
    ? [['github'], ['html', { open: 'never' }]]
    : [['list'], ['html', { open: 'never' }]],
  expect: { timeout: 10_000 },
  use: {
    baseURL,
    locale: 'pl-PL',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', testDir: './tests', use: { ...devices['Desktop Chrome'] } },
    { name: 'walk', testDir: './walk', use: { ...devices['Desktop Chrome'] } },
  ],
  // Locally: reuse the server of this task (termic run) or start it the same way.
  // CI: the production build started by `next start`.
  webServer: {
    command: ci ? 'pnpm --filter @sarmata/web start' : 'bash scripts/termic-run.sh',
    cwd: '..',
    url: `${baseURL}/logowanie`,
    reuseExistingServer: !ci,
    timeout: 180_000,
    env: { PORT: String(port) },
  },
});
