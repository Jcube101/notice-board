#!/usr/bin/env bash
#
# Migration: add `ip_hash` (text, optional) and `name_was_edited` (bool) fields
# to the `notes` collection on the live PocketBase.
#
# Credentials are read interactively and never written to a file or shell
# history (same approach as scripts/add-timestamp-fields.sh — see LEARNINGS.md).
# Run with:  ! bash scripts/add-ip-fields.sh
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

echo "Building updated fields array (adding ip_hash / name_was_edited if absent)…"
PATCH_BODY=$(printf '%s' "$COLLECTION" | python3 -c "
import sys, json
col = json.load(sys.stdin)
fields = col.get('fields', [])
names = {f.get('name') for f in fields}
to_add = []
if 'ip_hash' not in names:
    to_add.append({'name': 'ip_hash', 'type': 'text', 'required': False})
if 'name_was_edited' not in names:
    # PocketBase bool fields are false when unset, giving the 'default false' behaviour.
    to_add.append({'name': 'name_was_edited', 'type': 'bool', 'required': False})
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
