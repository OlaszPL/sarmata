#!/usr/bin/env bash
# Setup for a new termic task: dependencies and team secrets.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

pnpm secrets:decrypt

# Shared Supabase instance "sarmata" for all worktrees (ADR 0002).
if docker info >/dev/null 2>&1; then
  (cd database && { supabase status >/dev/null 2>&1 || supabase start; })
else
  echo "Docker is not running, skipping Supabase start"
fi
