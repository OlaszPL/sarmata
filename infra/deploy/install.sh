#!/bin/sh
# Starts the Sarmata installer for this system (Linux or macOS). Without arguments: install.
set -eu
dir=$(cd "$(dirname "$0")" && pwd)
case "$(uname -s)" in
  Linux) os=linux ;;
  Darwin) os=macos ;;
  *)
    echo "Nieobsługiwany system: $(uname -s)" >&2
    exit 1
    ;;
esac
case "$(uname -m)" in
  x86_64 | amd64) arch=x64 ;;
  aarch64 | arm64) arch=arm64 ;;
  *)
    echo "Nieobsługiwana architektura: $(uname -m)" >&2
    exit 1
    ;;
esac
bin="$dir/dist/sarmata-$os-$arch"
if [ ! -f "$bin" ]; then
  echo "Brak pliku $bin dla tego systemu." >&2
  exit 1
fi
chmod +x "$bin"
if [ "$os" = macos ]; then
  # A browser download is quarantined, and a cross-compiled binary may need an ad-hoc signature.
  xattr -d com.apple.quarantine "$bin" 2>/dev/null || true
  codesign --verify "$bin" 2>/dev/null || codesign --force --sign - "$bin"
fi
if [ $# -eq 0 ]; then
  set -- install
fi
exec "$bin" "$@"
