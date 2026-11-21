#!/bin/sh
# Database tasks of a Sarmata installation, run in the "tools" container (postgres client image).
# DATABASE_URL: migrations and SQL. BACKUP_DATABASE_URL and BACKUP_SCOPE (full or app): dumps.
# /data/db and /data/rollback: the database volume and its rollback snapshot (local Supabase only).
set -eu

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
    pg_dump "$BACKUP_DATABASE_URL" --format=custom --schema=public --schema=access --file="$file"
  fi
  echo "backup $file"
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

prune_dumps() {
  ls -1t /backups/pre-update-*.dump 2>/dev/null | tail -n +$(($1 + 1)) | while read -r old; do
    rm -f "$old"
  done
}

schedule() {
  while true; do
    dump "nightly-$(date +%Y%m%d-%H%M%S).dump" || echo "nightly backup failed" >&2
    find /backups -name 'nightly-*.dump' -mtime +14 -exec rm -f {} +
    sleep 86400
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
  snapshot) snapshot ;;
  restore-snapshot) restore_snapshot ;;
  clear-snapshot) empty_dir /data/rollback ;;
  prune-dumps) prune_dumps "$1" ;;
  schedule) schedule ;;
  *)
    echo "usage: dbtool.sh migrate | sql | dump FILE | snapshot | restore-snapshot | clear-snapshot | prune-dumps N | schedule" >&2
    exit 2
    ;;
esac
