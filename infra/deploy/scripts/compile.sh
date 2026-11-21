#!/usr/bin/env bash
# Cross-compiles the installer into single-file executables (ADR 0003). Bun is used only here.
# Run through pnpm so node_modules/.bin/bun is on PATH: pnpm --filter @sarmata/deploy compile
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf dist
mkdir -p dist

build() {
  # .env and bunfig.toml in the current directory must not change the installer's behaviour.
  bun build src/cli.ts --compile --minify --target="$1" --outfile="dist/$2" \
    --no-compile-autoload-dotenv --no-compile-autoload-bunfig
  echo "dist/$2"
}

build bun-windows-x64 sarmata-windows-x64.exe
build bun-linux-x64 sarmata-linux-x64
build bun-linux-arm64 sarmata-linux-arm64
build bun-darwin-arm64 sarmata-macos-arm64
