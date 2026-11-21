#!/usr/bin/env bash
# Setup for a new termic task: dependencies, team secrets, Supabase, the web app env and the e2e browser.
set -euo pipefail
cd "$(dirname "$0")/.."

# Warnings only: the setup continues so a missing tool does not hide the other steps.
bash scripts/doctor.sh || true

pnpm install --frozen-lockfile

if command -v direnv >/dev/null 2>&1; then
  direnv allow
fi

pnpm secrets:decrypt

# Shared Supabase instance "sarmata" for all worktrees (docs/architektura.md, "Narzędzia deweloperskie").
if docker info >/dev/null 2>&1; then
  (cd database && { pnpm exec supabase status >/dev/null 2>&1 || pnpm exec supabase start; })
  # Web app env (frontend/web/.env.local) from the running instance.
  pnpm web:env
else
  echo "Docker is not running, skipping Supabase start and frontend/web/.env.local"
fi

# Browser for the e2e tests and the app-walkthrough skill. Shared cache, fast after the first run.
pnpm --filter @sarmata/e2e exec playwright install chromium
