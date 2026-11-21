#!/usr/bin/env bash
# Run script for a termic task: Next.js dev server on a port derived from the task name.
set -euo pipefail
cd "$(dirname "$0")/.."

port="$(node scripts/task-port.mjs)"
export PORT="$port"
export SITE_URL="http://localhost:$port"

if [ ! -f frontend/web/.env.local ]; then
  pnpm web:env
fi

echo "sarmata: $SITE_URL"
exec pnpm dev
