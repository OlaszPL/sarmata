#!/usr/bin/env bash
# Setup nowego taska termic: zależności i sekrety zespołu.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

pnpm secrets:decrypt
