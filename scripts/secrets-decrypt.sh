#!/usr/bin/env bash
# Decrypts the team secrets into .env.local (ignored by git).
set -euo pipefail
cd "$(dirname "$0")/.."

export SOPS_AGE_KEY_FILE="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"
if [ -z "${SOPS_AGE_KEY:-}" ] && [ ! -f "$SOPS_AGE_KEY_FILE" ]; then
  echo "No age key ($SOPS_AGE_KEY_FILE), skipping secrets decryption"
  exit 0
fi

umask 077
tmp="$(mktemp .env.local.XXXXXX)"
trap 'rm -f "$tmp"' EXIT
sops --decrypt secrets/dev.enc.env > "$tmp"
mv "$tmp" .env.local
echo "Wrote .env.local"
