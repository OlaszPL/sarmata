#!/usr/bin/env bash
# Release archive for offices: committed sources at HEAD plus the compiled installers.
# Usage: pnpm --filter @sarmata/deploy release VERSION
set -euo pipefail
version="${1:?usage: release.sh VERSION}"
deploy="$(cd "$(dirname "$0")/.." && pwd)"
root="$(git -C "$deploy" rev-parse --show-toplevel)"
out="$deploy/release"
archive="$out/sarmata-$version.zip"

bash "$deploy/scripts/compile.sh"
rm -rf "$out"
mkdir -p "$out/sarmata/infra/deploy/dist"
git -C "$root" archive --format=zip --prefix=sarmata/ -o "$archive" HEAD
# .gitattributes marks team secrets and tooling export-ignore. Refuse an archive that has them.
if unzip -Z1 "$archive" | grep -E '^sarmata/(secrets/|\.sops\.yaml$|\.mcp\.json$|\.claude/|\.agents/|\.codex/)'; then
  echo "release archive contains files that must stay in the repository (see .gitattributes)" >&2
  rm -f "$archive"
  exit 1
fi
cp "$deploy"/dist/sarmata-* "$out/sarmata/infra/deploy/dist/"
printf '%s\n' "$version" > "$out/sarmata/VERSION"
(cd "$out" && zip -q -r "$(basename "$archive")" sarmata/VERSION sarmata/infra/deploy/dist)
rm -rf "$out/sarmata"
echo "$archive"
