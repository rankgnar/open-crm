#!/usr/bin/env bash
# Aplica migrationer i supabase/migrations/ mot Supabase Cloud via Management API.
# Spårar applicerade filer i tabellen _applied_migrations så att varje fil körs
# exakt en gång, i lexikografisk ordning (timestamp-prefix).
#
# Krävs: SUPABASE_ACCESS_TOKEN (PAT), SUPABASE_PROJECT_REF.

set -euo pipefail

if [[ -f ".env" && -z "${CI:-}" ]]; then
  set -a; source .env; set +a
fi
SUPABASE_PROJECT_REF="${SUPABASE_PROJECT_REF:-$(echo "${SUPABASE_URL:-}" | sed 's|https://\([^.]*\)\..*|\1|')}"

: "${SUPABASE_ACCESS_TOKEN:?SUPABASE_ACCESS_TOKEN saknas}"
: "${SUPABASE_PROJECT_REF:?SUPABASE_PROJECT_REF saknas}"

API="https://api.supabase.com/v1/projects/${SUPABASE_PROJECT_REF}/database/query"
AUTH="Authorization: Bearer ${SUPABASE_ACCESS_TOKEN}"

run_sql() {
  local sql="$1"
  local tmpjson
  tmpjson=$(mktemp)
  # pipe via jq -Rs to avoid ARG_MAX limits on large SQL files
  printf '%s' "$sql" | jq -Rs '{query:.}' > "$tmpjson"
  curl -sS -X POST "$API" \
    -H "$AUTH" \
    -H "Content-Type: application/json" \
    --data "@$tmpjson"
  rm -f "$tmpjson"
}

# Säkerställ att tracking-tabellen finns
run_sql "CREATE TABLE IF NOT EXISTS _applied_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);" > /dev/null

# Hämta redan applicerade filnamn
applied=$(run_sql "SELECT filename FROM _applied_migrations;" | jq -r '.[].filename')

shopt -s nullglob
applied_count=0
skip_count=0

for f in supabase/migrations/*.sql; do
  fname=$(basename "$f")

  if printf '%s\n' "$applied" | grep -qFx "$fname"; then
    echo "skip   $fname"
    skip_count=$((skip_count + 1))
    continue
  fi

  echo "apply  $fname"
  sql=$(cat "$f")
  resp=$(run_sql "$sql")

  # Management API returnerar { "message": "..." } vid fel, annars en array
  if printf '%s' "$resp" | jq -e 'type == "object" and has("message")' > /dev/null; then
    echo "::error file=$f::Migration misslyckades"
    printf '%s\n' "$resp" | jq .
    exit 1
  fi

  esc=$(printf '%s' "$fname" | sed "s/'/''/g")
  run_sql "INSERT INTO _applied_migrations (filename) VALUES ('$esc');" > /dev/null
  applied_count=$((applied_count + 1))
done

echo
echo "Klar — applicerade: $applied_count, hoppade över: $skip_count"
