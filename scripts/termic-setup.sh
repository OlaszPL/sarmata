#!/usr/bin/env bash
# Setup nowego taska termic: zależności i sekrety zespołu.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

klucz="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
if [ -f "$klucz" ]; then
  pnpm secrets:decrypt
else
  echo "Brak klucza age ($klucz), pomijam odszyfrowanie sekretów"
fi
