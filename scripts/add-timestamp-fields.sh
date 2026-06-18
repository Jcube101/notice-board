#!/usr/bin/env bash
#
# One-off migration: add `created` and `updated` autodate fields to the
# `notes` collection on the live PocketBase.
#
# Phase 1 created the collection without these system fields, which breaks
# getNotes() (sort=-created) and the archiving age check. This adds them.
#
# Credentials are read interactively and never written to a file or shell
# history (same approach as the original collection-creation script — see
# LEARNINGS.md). Run with:  ! bash scripts/add-timestamp-fields.sh
#
set -euo pipefail

PB_URL="https://pb.job-joseph.com"

read -r -p "PocketBase superuser email: " PB_IDENTITY
read -r -s -p "PocketBase superuser password: " PB_PASSWORD
echo

echo "Authenticating…"
TOKEN=$(curl -s -X POST "$PB_URL/api/collections/_superusers/auth-with-password" \
  -H "Content-Type: application/json" \
  -d "{\"identity\":\"$PB_IDENTITY\",\"password\":\"$PB_PASSWORD\"}" \
  | python3 -c "import sys,json; print(json.load(sys.stdin).get('token',''))")
unset PB_IDENTITY PB_PASSWORD

if [ -z "$TOKEN" ]; then
  echo "❌ Auth failed (no token returned)." >&2
  exit 1
fi

echo "Fetching current collection definition…"
COLLECTION=$(curl -s "$PB_URL/api/collections/notes" -H "Authorization: $TOKEN")

echo "Building updated fields array (adding created/updated if absent)…"
PATCH_BODY=$(printf '%s' "$COLLECTION" | python3 -c "
import sys, json
col = json.load(sys.stdin)
fields = col.get('fields', [])
names = {f.get('name') for f in fields}
to_add = []
if 'created' not in names:
    to_add.append({'name': 'created', 'type': 'autodate', 'onCreate': True, 'onUpdate': False})
if 'updated' not in names:
    to_add.append({'name': 'updated', 'type': 'autodate', 'onCreate': True, 'onUpdate': True})
print(json.dumps({'fields': fields + to_add}))
")

echo "Patching collection…"
curl -s -X PATCH "$PB_URL/api/collections/notes" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PATCH_BODY" > /dev/null
unset TOKEN

echo "Verifying…"
KEYS=$(curl -s "$PB_URL/api/collections/notes/records?perPage=1" \
  | python3 -c "import sys,json; items=json.load(sys.stdin)['items']; print(sorted(items[0].keys())) if items else print('(no records yet)')")
echo "Record keys now: $KEYS"
echo "✅ Done."
