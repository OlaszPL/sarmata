#!/usr/bin/env bash
# Checks the local toolchain. Exits non-zero only when a required tool is missing.
cd "$(dirname "$0")/.."

REQUIRED_NODE_MAJOR=24
REQUIRED_PNPM=12.21.0
AGE_KEY="${SOPS_AGE_KEY_FILE:-$HOME/.config/sops/age/keys.txt}"

missing=0

ok() { printf '  [ok]   %s\n' "$1"; }
warn() { printf '  [warn] %s\n' "$1"; }
fail() {
  printf '  [FAIL] %s\n' "$1"
  missing=1
}

# install_hint <macOS brew> <Debian/Ubuntu> <Windows winget>
install_hint() {
  printf '           macOS:          %s\n' "$1"
  printf '           Debian/Ubuntu:  %s\n' "$2"
  printf '           Windows:        %s\n' "$3"
}

echo "sarmata doctor"

# Node
if command -v node >/dev/null 2>&1; then
  node_version="$(node -v)"
  node_major="${node_version#v}"
  node_major="${node_major%%.*}"
  if [ "$node_major" = "$REQUIRED_NODE_MAJOR" ]; then
    ok "node $node_version"
  else
    fail "node $node_version, need ${REQUIRED_NODE_MAJOR}.x (see .nvmrc)"
    install_hint "brew install node@$REQUIRED_NODE_MAJOR" \
      "curl -fsSL https://deb.nodesource.com/setup_$REQUIRED_NODE_MAJOR.x | sudo -E bash - && sudo apt-get install -y nodejs" \
      "winget install OpenJS.NodeJS --version $REQUIRED_NODE_MAJOR"
  fi
else
  fail "node not found"
  install_hint "brew install node@$REQUIRED_NODE_MAJOR" \
    "curl -fsSL https://deb.nodesource.com/setup_$REQUIRED_NODE_MAJOR.x | sudo -E bash - && sudo apt-get install -y nodejs" \
    "winget install OpenJS.NodeJS --version $REQUIRED_NODE_MAJOR"
fi

# pnpm
if command -v pnpm >/dev/null 2>&1; then
  pnpm_version="$(pnpm --version 2>/dev/null)"
  if [ "$pnpm_version" = "$REQUIRED_PNPM" ]; then
    ok "pnpm $pnpm_version"
  else
    fail "pnpm $pnpm_version, need $REQUIRED_PNPM"
    install_hint "corepack enable && corepack prepare pnpm@$REQUIRED_PNPM --activate" \
      "corepack enable && corepack prepare pnpm@$REQUIRED_PNPM --activate" \
      "corepack enable; corepack prepare pnpm@$REQUIRED_PNPM --activate"
  fi
else
  fail "pnpm not found"
  install_hint "corepack enable && corepack prepare pnpm@$REQUIRED_PNPM --activate" \
    "corepack enable && corepack prepare pnpm@$REQUIRED_PNPM --activate" \
    "corepack enable; corepack prepare pnpm@$REQUIRED_PNPM --activate"
fi

# Docker
if command -v docker >/dev/null 2>&1; then
  if docker info >/dev/null 2>&1; then
    ok "docker installed and running"
  else
    fail "docker is installed but not running, start Docker Desktop or the docker service"
  fi
else
  fail "docker not found"
  install_hint "brew install --cask docker" \
    "curl -fsSL https://get.docker.com | sudo sh" \
    "winget install Docker.DockerDesktop"
fi

# sops
if command -v sops >/dev/null 2>&1; then
  ok "sops $(sops --version 2>/dev/null | head -n 1)"
else
  fail "sops not found"
  install_hint "brew install sops" \
    "download the .deb from https://github.com/getsops/sops/releases and run sudo dpkg -i <file>.deb" \
    "winget install Mozilla.SOPS"
fi

# age
if command -v age >/dev/null 2>&1; then
  ok "age $(age --version 2>/dev/null | head -n 1)"
else
  fail "age not found"
  install_hint "brew install age" \
    "sudo apt-get install -y age" \
    "winget install FiloSottile.age"
fi

# age key
if [ -f "$AGE_KEY" ]; then
  ok "age key at $AGE_KEY"
else
  fail "age key missing at $AGE_KEY (ask the team for the key, or set SOPS_AGE_KEY_FILE)"
fi

# direnv (optional)
if command -v direnv >/dev/null 2>&1; then
  ok "direnv $(direnv version 2>/dev/null)"
else
  warn "direnv not found (optional, loads .envrc automatically)"
  install_hint "brew install direnv" \
    "sudo apt-get install -y direnv" \
    "winget install direnv.direnv"
fi

# Supabase CLI (from the @sarmata/database devDependency)
if command -v pnpm >/dev/null 2>&1 && supabase_version="$(pnpm --silent --filter @sarmata/database exec supabase --version 2>/dev/null)" && [ -n "$supabase_version" ]; then
  ok "supabase $supabase_version (via pnpm)"
else
  fail "supabase CLI not available via pnpm, run: pnpm install"
fi

if [ "$missing" -ne 0 ]; then
  echo "Missing required tools, see above."
  exit 1
fi
echo "All required tools are present."
