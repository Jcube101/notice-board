#!/usr/bin/env bash
#
# Migration: add a `reactions` (json, optional) field to the `notes` collection
# on the live PocketBase. Stores a map of emoji → count, e.g. {"👋":3,"🔥":1}.
#
# The initial collection was created via curl without this field — PocketBase
# does not add it implicitly — so it is patched in here, the same way the
# timestamp and ip_hash fields were.
#
# Credentials are read interactively and never written to a file or shell
# history (same approach as scripts/add-ip-fields.sh — see LEARNINGS.md).
# Run with:  ! bash scripts/add-reactions-field.sh
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

echo "Building updated fields array (adding reactions if absent)…"
PATCH_BODY=$(printf '%s' "$COLLECTION" | python3 -c "
import sys, json
col = json.load(sys.stdin)
fields = col.get('fields', [])
names = {f.get('name') for f in fields}
to_add = []
if 'reactions' not in names:
    # Mirror the existing json field's maxSize so reactions is consistent.
    content = next((f for f in fields if f.get('name') == 'content'), None)
    max_size = content.get('maxSize', 0) if content else 0
    to_add.append({'name': 'reactions', 'type': 'json', 'required': False, 'maxSize': max_size})
print(json.dumps({'fields': fields + to_add}))
")

echo "Patching collection…"
curl -s -X PATCH "$PB_URL/api/collections/notes" \
  -H "Authorization: $TOKEN" \
  -H "Content-Type: application/json" \
  -d "$PATCH_BODY" > /dev/null

echo "Verifying field list…"
curl -s "$PB_URL/api/collections/notes" -H "Authorization: $TOKEN" \
  | python3 -c "import sys,json; print('Fields now:', [f['name'] for f in json.load(sys.stdin).get('fields', [])])"
unset TOKEN
echo "✅ Done."
