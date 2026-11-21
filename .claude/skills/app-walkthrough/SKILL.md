---
name: app-walkthrough
description: Use when you need to see the sarmata web app working in a real browser, such as checking a UI change before calling it done, reproducing a UI bug, signing in as a demo account (admin, kadry, oceniający) or taking screenshots for review.
---

# App walkthrough

## Overview

Repeatable clicks live in code (`e2e/src`, `e2e/walk`), not in your head. Run the walk, read the screenshots, and turn any path you click twice into a helper or a test.

## Before you start

| Check | Command | Fix |
|---|---|---|
| Supabase runs | `pnpm db:status` | `pnpm db:start` |
| App env exists | `test -f frontend/web/.env.local` | `pnpm web:env` |
| Browser installed | `pnpm --filter @sarmata/e2e exec playwright install chromium` | same command |

## Start the app

- Port of this task: `node scripts/task-port.mjs` (3000 outside Termic). URL: `http://localhost:<port>`.
- In Termic start the task's run script with the termic `task_run` tool. Elsewhere run `bash scripts/termic-run.sh` in the background.
- Ready when `curl -s -o /dev/null -w '%{http_code}' http://localhost:<port>/logowanie` prints `200`.
- You may skip this: `pnpm e2e` and `pnpm e2e:walk` reuse the running server or start it themselves.

## Demo accounts

Password for all: `Haslo-Demo-2026`. Office: Urząd Ministerstwa Testowego w Kropce Wielkopolskiej.

| Role (`WALK_ACCOUNTS`) | E-mail | Label in the UI |
|---|---|---|
| `admin` | `admin@kropka.test` | Administrator |
| `hr` | `kadry@kropka.test` | Kadry |
| `evaluator` | `oceniajacy@kropka.test` | Oceniający |

## Screenshots

```bash
WALK_ACCOUNTS=hr,evaluator WALK_PATHS=/ pnpm e2e:walk
```

- Output: `e2e/.screenshots/logowanie.png` and `e2e/.screenshots/<role>/<path-slug>.png` (`/` is `start.png`). Open them with the Read tool.
- The run fails on browser console errors and prints them with a `[walk]` prefix.
- New screen: add its path to `WALK_PATHS`. Needs a form filled first? Add a helper to `e2e/src/` and call it from `e2e/walk/walk.spec.ts`.

## Interactive exploration

When the Playwright MCP tools are available, use `browser_navigate` to `http://localhost:<port>/logowanie`, sign in with the table above and use `browser_snapshot` to read the page. Once a path works, move it into `e2e/src` so the next agent does not click it again.

## Tests

- `pnpm e2e`: sign-in and sign-out for every demo account, axe WCAG 2.1 AA checks.
- `pnpm e2e:ui`: the same in Playwright UI mode.
- A flow you verified by hand belongs in `e2e/tests/` as a spec that uses the helpers from `e2e/src/session.ts`.

## Common mistakes

| Symptom | Cause and fix |
|---|---|
| Second `next dev` fails with a lock error | Next.js 16 allows one dev server per directory. Use the running one on the task port. |
| Redirect loop or signed out right away | Mixed `localhost` and `127.0.0.1`. Always use `http://localhost:<port>`. |
| `Invalid environment for @sarmata/web` | Run `pnpm web:env` after Supabase started. |
| Sign-in returns 429 | Supabase limits sign-ins per IP (30 per 5 minutes). Wait or sign in less often. |
| Data from an earlier run on screenshots | `pnpm db:reset` restores the demo seed. |

## Keep this skill honest

When a step here fails, misleads you or you find a faster path, fix this file in the same change and add the lesson to "Common mistakes".
