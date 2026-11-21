# Fix report: final review plan 1

Status: all findings fixed (C1, I1, I2, I3, M1 to M7).

## Changes per finding

- C1, M1: `scripts/secrets-decrypt.sh` is the only owner of the age key location (`SOPS_AGE_KEY_FILE` default `~/.config/sops/age/keys.txt`, exported for sops), skips with a message when the key is missing, writes through `umask 077` and a temp file moved with `mv`. `scripts/termic-setup.sh` now just runs `pnpm secrets:decrypt`. README names the key location.
- I1: `turbo.json` has `"globalDependencies": ["tsconfig.base.json"]`.
- I2: `zeSkladowych` in `data-kalendarzowa.ts` is the single guard: integer parts, year 1000 to 9999, month, day. New tests: `0999-01-01`, `0000-01-01` rejected, `9999-12-01 + 1` and `MAX_SAFE_INTEGER` months throw `RangeError`.
- I3, M4: `eslint.config.mjs`. Domain blocks `node:*`, relative paths `**/repositories/**`, `**/services/**`, `**/database/**`, and global `process`. Frontend blocks `@sarmata/ai`, `@sarmata/worker`, `@supabase/supabase-js` (`@supabase/ssr` left allowed) and relative `**/backend/{repositories,ai,worker}/**`.
- M2: lint-staged formats `json,yml,yaml,css,md,mdx,html`.
- M3: root `typescript` is `catalog:`, lockfile regenerated (`pnpm install --lockfile-only`, 1 line).
- M5: CI has `permissions: contents: read` and `cancel-in-progress` only for pull requests.
- M6: three cases added to `dodaj-miesiace.test.ts`.
- M7: dropped `/node_modules` and `.env.local` from `.gitignore`.
- Plan test count line changed from 13 to 19 (8 + 11).

## Verification

- `rtk pnpm check`: lint, prettier, typecheck pass, `Tests 19 passed (19)` (8 + 11). Second run `FULL TURBO`.
- `rtk pnpm secrets:decrypt && grep -c SARMATA_SECRETS_OK .env.local && stat -f '%Lp' .env.local`: `Zapisano .env.local`, `1`, `600`.
- `bash scripts/termic-setup.sh`: lockfile up to date, `Zapisano .env.local`, exit 0.
- I1 probe (comment appended to `tsconfig.base.json`, then reverted, no diff left): `@sarmata/domain:typecheck: cache miss`.
- ESLint probes (throwaway files, deleted): `node:fs` in domain, `process.env` in domain, `../../repositories/src/index` in domain, `../backend/repositories/src/index`, `@supabase/supabase-js` and `@sarmata/ai` in frontend all report errors with the Polish ADR 0004 messages.

## Addendum: English code rename (user requirement)

- `git mv` of `src/terminy` to `src/deadlines`, `calendar-date.ts`, `add-months.ts` and their tests.
- Identifiers: `CalendarDate`, `calendarDate`, `toParts` (returns `{year, month, day}`), `fromParts`, `lastDayOfMonth`, `addMonths`, English locals, comments, RangeError texts and test names. The legal reference art. 112 Kc and the KPRM note stay.
- ESLint messages and shell script echo and comments are English (still citing ADR 0004). README and docs stay Polish. The plan file got an identifier and path search-and-replace only.
- Re-verification after the rename: `pnpm check` passes with 19 tests, decrypt prints `Wrote .env.local` with mode 600, setup exits 0, I1 probe gives a cache miss, ESLint probes still fire.
