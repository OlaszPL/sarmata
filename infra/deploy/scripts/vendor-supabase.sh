#!/usr/bin/env bash
# Vendors docker/ from supabase/supabase at a pinned tag (self-hosted Supabase, Apache-2.0).
# Usage: scripts/vendor-supabase.sh [TAG]
set -euo pipefail
tag="${1:-v1.26.08}"
deploy="$(cd "$(dirname "$0")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git clone --quiet --depth 1 --branch "$tag" --filter=blob:none --sparse \
  https://github.com/supabase/supabase.git "$tmp/supabase"
git -C "$tmp/supabase" sparse-checkout set docker

target="$deploy/supabase"
rm -rf "$target"
mkdir -p "$target/volumes"
cp "$tmp/supabase/docker/docker-compose.yml" "$tmp/supabase/docker/versions.md" "$target/"
cp "$tmp/supabase/LICENSE" "$target/LICENSE"
cp -R "$tmp/supabase/docker/volumes/api" "$tmp/supabase/docker/volumes/db" \
  "$tmp/supabase/docker/volumes/functions" "$target/volumes/"
rm -rf "$target/volumes/api/envoy"
commit="$(git -C "$tmp/supabase" rev-parse HEAD)"
printf 'supabase/supabase %s (%s), katalog docker/\n' "$tag" "$commit" > "$target/UPSTREAM"
echo "vendored supabase $tag into $target"
