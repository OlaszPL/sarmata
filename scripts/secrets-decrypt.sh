#!/usr/bin/env bash
# Odszyfrowuje sekrety zespołu do .env.local (ignorowany przez git).
set -euo pipefail
cd "$(dirname "$0")/.."
sops --decrypt secrets/dev.enc.env > .env.local
echo "Zapisano .env.local"
