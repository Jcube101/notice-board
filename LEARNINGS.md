# LEARNINGS

## PocketBase collection creation via REST API

The `notes` collection was created entirely via curl against the PocketBase REST API — no admin UI clicks, no migration files.

**Flow:**

1. Authenticate as superuser → `POST /api/collections/_superusers/auth-with-password` with `{ identity, password }`. Returns a JWT in `.token`.
2. Send the token as the `Authorization` header on `POST /api/collections` with the full collection definition (name, type, fields, rules).
3. Verify with `GET /api/collections/<name>`.

**Credential handling:** email and password were never written to a file or passed on the command line. The script used `read -r` and `read -r -s` to prompt for them interactively, held them in shell variables, used them in the auth request, then `unset` them. This keeps creds out of shell history, env dumps, and any saved file.

**Schema format note:** PocketBase v0.23+ uses the new `fields` array (each entry self-describing with `name`, `type`, plus per-type options like `values` for select, `maxSize` for json). The old `schema` array shape is deprecated — anything copy-pasted from older docs will quietly fail.
