#!/bin/sh
# Database tasks of a Sarmata installation, run in the "tools" container (postgres client image).
# DATABASE_URL: migrations and SQL. BACKUP_DATABASE_URL and BACKUP_SCOPE (full or app): dumps.
# /data/db and /data/rollback: the database volume and its rollback snapshot (local Supabase only).
set -eu
# Dumps hold password hashes and personal data: readable by the owner (root) only.
umask 077

wait_for_db() {
  i=0
  until pg_isready -q -d "$DATABASE_URL"; do
    i=$((i + 1))
    if [ "$i" -ge 60 ]; then
      echo "database not ready after 120 s" >&2
      exit 1
    fi
    sleep 2
  done
}

# Same bookkeeping table as the Supabase CLI, so both tools agree on what is applied.
migrate() {
  wait_for_db
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q <<'SQL'
create schema if not exists supabase_migrations;
create table if not exists supabase_migrations.schema_migrations (
  version text primary key,
  statements text[],
  name text
);
SQL
  for file in $(ls /migrations/*.sql | sort); do
    base=$(basename "$file" .sql)
    version=${base%%_*}
    name=${base#*_}
    case "$version" in
      '' | *[!0-9]*)
        echo "bad migration file name: $base" >&2
        exit 1
        ;;
    esac
    applied=$(psql "$DATABASE_URL" -tAq -c "select 1 from supabase_migrations.schema_migrations where version = '$version'")
    if [ "$applied" = "1" ]; then
      continue
    fi
    echo "migration $base"
    {
      cat "$file"
      printf '\ninsert into supabase_migrations.schema_migrations (version, name) values (%s, $name$%s$name$);\n' "'$version'" "$name"
    } | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q --single-transaction -f -
  done
  # PostgREST caches the schema.
  psql "$DATABASE_URL" -q -c "notify pgrst, 'reload schema'"
}

dump() {
  file="/backups/$1"
  if [ "$BACKUP_SCOPE" = "full" ]; then
    pg_dump "$BACKUP_DATABASE_URL" --format=custom --file="$file"
  else
    # The migration bookkeeping comes along, so a restored dump and its schema version match.
    pg_dump "$BACKUP_DATABASE_URL" --format=custom --schema=public --schema=access \
      --schema=supabase_migrations --file="$file"
  fi
  echo "backup $file"
}

# Restores a dump from /backups into the database. The caller stops the app first and runs migrate
# after it. Full dumps (local Supabase) bring back the app schemas, the accounts and the stored
# files metadata. Supabase's own roles, extensions and settings come from the running stack.
restore() {
  file="/backups/$1"
  if [ ! -f "$file" ]; then
    echo "no such backup: $file" >&2
    exit 1
  fi
  if [ "$BACKUP_SCOPE" = "full" ]; then
    pg_restore --dbname="$BACKUP_DATABASE_URL" --clean --if-exists --single-transaction \
      --exit-on-error --schema=public --schema=access --schema=auth --schema=storage \
      --schema=supabase_migrations "$file"
  else
    pg_restore --dbname="$BACKUP_DATABASE_URL" --clean --if-exists --no-owner --single-transaction \
      --exit-on-error "$file"
  fi
  psql "$DATABASE_URL" -q -c "notify pgrst, 'reload schema'"
  echo "restored $file"
}

empty_dir() {
  find "$1" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
}

snapshot() {
  empty_dir /data/rollback
  cp -a /data/db/. /data/rollback/
}

restore_snapshot() {
  if [ -z "$(ls -A /data/rollback)" ]; then
    echo "no snapshot to restore" >&2
    exit 1
  fi
  empty_dir /data/db
  cp -a /data/rollback/. /data/db/
}

# Keeps the newest N files that match a pattern in /backups.
keep_newest() {
  ls -1t /backups/$1 2>/dev/null | tail -n +$(($2 + 1)) | while read -r old; do
    rm -f "$old"
  done
}

prune_dumps() {
  keep_newest 'pre-update-*.dump' "$1"
}

# Seconds until the next HH:00 in the container's time zone (TZ, Europe/Warsaw in compose.yaml).
seconds_until() {
  set -- "$1" "$(date +%H)" "$(date +%M)" "$(date +%S)"
  now=$((${2#0} * 3600 + ${3#0} * 60 + ${4#0}))
  left=$(($1 * 3600 - now))
  if [ "$left" -le 0 ]; then
    left=$((left + 86400))
  fi
  echo "$left"
}

# Nightly at 02:00, outside office hours, keeping the 14 newest nightly dumps.
schedule() {
  while true; do
    sleep "$(seconds_until 2)"
    dump "nightly-$(date +%Y%m%d-%H%M%S).dump" || echo "nightly backup failed" >&2
    keep_newest 'nightly-*.dump' 14
  done
}

command=${1:-}
if [ $# -gt 0 ]; then
  shift
fi
case "$command" in
  migrate) migrate ;;
  sql)
    wait_for_db
    psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f -
    ;;
  dump)
    wait_for_db
    dump "$1"
    ;;
  restore)
    wait_for_db
    restore "$1"
    ;;
  snapshot) snapshot ;;
  restore-snapshot) restore_snapshot ;;
  clear-snapshot) empty_dir /data/rollback ;;
  prune-dumps) prune_dumps "$1" ;;
  schedule) schedule ;;
  *)
    echo "usage: dbtool.sh migrate | sql | dump FILE | restore FILE | snapshot | restore-snapshot | clear-snapshot | prune-dumps N | schedule" >&2
    exit 2
    ;;
esac
