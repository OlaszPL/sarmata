#!/usr/bin/env bash
# Odszyfrowuje sekrety zespołu do .env.local (ignorowany przez git).
set -euo pipefail
cd "$(dirname "$0")/.."

export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
if [ -z "${SOPS_AGE_KEY:-}" ] && [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
  echo "Brak klucza age ($SOPS_AGE_KEY_FILE), pomijam odszyfrowanie sekretów"
  exit 0
fi

umask 077
tmp="$(mktemp .env.local.XXXXXX)"
trap 'rm -f "$tmp"' EXIT
sops --decrypt secrets/dev.enc.env > "$tmp"
mv "$tmp" .env.local
echo "Zapisano .env.local"
