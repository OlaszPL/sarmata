#!/usr/bin/env bash
# Runs a command with SUPABASE_URL and the keys of the local "sarmata" instance.
# For development and integration tests only. A set SUPABASE_URL (e.g. an external instance) wins.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ -z "${SUPABASE_URL:-}" ]; then
  status=$(cd database && pnpm exec supabase status -o json)
  eval "$(printf '%s' "$status" | python3 -c '
import json, shlex, sys
d = json.load(sys.stdin)
values = {
    "SUPABASE_URL": d["API_URL"],
    "SUPABASE_PUBLISHABLE_KEY": d.get("PUBLISHABLE_KEY") or d["ANON_KEY"],
    "SUPABASE_SECRET_KEY": d.get("SECRET_KEY") or d["SERVICE_ROLE_KEY"],
}
for name, value in values.items():
    print(f"export {name}={shlex.quote(value)}")
')"
fi

exec "$@"
