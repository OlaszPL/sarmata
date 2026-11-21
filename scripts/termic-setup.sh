#!/usr/bin/env bash
# Setup for a new termic task: dependencies and team secrets.
set -euo pipefail
cd "$(dirname "$0")/.."

pnpm install --frozen-lockfile

pnpm secrets:decrypt
