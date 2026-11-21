#!/usr/bin/env bash
# Setup for a new termic task: dependencies and team secrets.
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
else
  echo "Docker is not running, skipping Supabase start"
fi

# AI models and llama.cpp are machine-wide (user data dir), so a new worktree never downloads them
# again. This only writes .env.ai.local when AI is already set up on this machine.
pnpm ai:env || true
