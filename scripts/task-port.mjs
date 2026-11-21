// Port of the Next.js dev server for this worktree: 3000 outside Termic, otherwise derived from
// the task name so parallel tasks do not collide. Used by scripts/termic-run.sh and
// e2e/playwright.config.ts, so the app, the e2e tests and the walkthrough skill agree.

/**
 * @param {string | undefined} task Termic task name, defaults to $TERMIC_TASK.
 * @returns {number}
 */
export function taskPort(task = process.env.TERMIC_TASK) {
  if (!task) return 3000;
  let hash = 0;
  for (const char of task) hash = (hash * 31 + (char.codePointAt(0) ?? 0)) >>> 0;
  return 3001 + (hash % 999);
}

// Plain text on purpose: console.log of a number is colored when FORCE_COLOR is set (Playwright).
if (import.meta.main) process.stdout.write(`${taskPort()}\n`);
