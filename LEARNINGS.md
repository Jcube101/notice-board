# LEARNINGS

## PocketBase collection creation via REST API

The `notes` collection was created entirely via curl against the PocketBase REST API — no admin UI clicks, no migration files.

**Flow:**

1. Authenticate as superuser → `POST /api/collections/_superusers/auth-with-password` with `{ identity, password }`. Returns a JWT in `.token`.
2. Send the token as the `Authorization` header on `POST /api/collections` with the full collection definition (name, type, fields, rules).
3. Verify with `GET /api/collections/<name>`.

**Credential handling:** email and password were never written to a file or passed on the command line. The script used `read -r` and `read -r -s` to prompt for them interactively, held them in shell variables, used them in the auth request, then `unset` them. This keeps creds out of shell history, env dumps, and any saved file.

**Schema format note:** PocketBase v0.23+ uses the new `fields` array (each entry self-describing with `name`, `type`, plus per-type options like `values` for select, `maxSize` for json). The old `schema` array shape is deprecated — anything copy-pasted from older docs will quietly fail.

## Phase 2 — integration layer

### `bad-words` v4 is ESM-only with a changed API

v4 dropped the default export. It now exports a named `Filter`:
`import { Filter } from 'bad-words'`. The old `import Filter from 'bad-words'`
(default import) silently yields `undefined` and `new Filter()` throws. Its
`package.json` also locks down `exports`, so subpaths like `bad-words/package.json`
are not resolvable.

### `@types/dompurify` is now a deprecation stub

`dompurify` v3 ships its own type definitions. The separately-installed
`@types/dompurify` (requested for this phase) is just a stub that re-points to the
bundled types — harmless, but redundant on v3. If TS ever complains about
duplicate `DOMPurify` declarations, removing `@types/dompurify` is the fix.

### DOMPurify as a validation check, not just a sanitizer

Rather than silently rewriting user input, `validation.ts` sanitizes with
`{ ALLOWED_TAGS: [], ALLOWED_ATTR: [] }` and **compares** the result to the
original. If they differ, the input contained markup and is *rejected* — note
content is meant to be plain text. DOMPurify relies on a DOM, so this runs in the
browser; pure-Node unit tests would need jsdom.

### Percentage coordinates

`position_x` / `position_y` are stored as 0–100 percentages, not pixels, so notes
keep their relative spot across viewport sizes. `updatePosition` overwrites both.

### Scaffolding into a non-empty repo

`npm create vite` won't scaffold into a directory that already has docs, so it was
generated into a temp dir and merged in, preserving the existing `README.md`,
`SPEC.md`, `ROADMAP.md`, and `LEARNINGS.md`.

### Discriminated union ties `type` to `content`

`Note = NoteBase & NoteContent`, where `NoteContent` is a union of
`{ type; content }` pairs. Narrowing on `note.type` narrows `note.content`, and
`createNote<T>(type, content, …)` uses `ContentFor<T>` so call sites can't pass a
mismatched payload for the chosen type.

## Phase 2 — tests & seeding

### Phase 1 collection was missing `created` / `updated` fields

The biggest surprise: the live `notes` collection had **no autodate `created` or
`updated` fields**. SPEC.md claimed they were "auto-managed by PocketBase", but
PocketBase v0.23+ only adds autodate fields if you include them in the `fields`
array at creation — they are *not* implicit. This surfaced when the seed script's
post-create archive check called `getNotes()` (which sorts by `-created`) and the
API returned a generic `400 "Something went wrong"`. Probing with curl showed
record keys had no `created`/`updated`, and `sort=-created` alone 400s.

Fixed with `scripts/add-timestamp-fields.sh`: superuser-auth → GET the collection
→ append `{type:'autodate', onCreate:true}` (and `onUpdate:true` for `updated`) →
PATCH. Existing records get backfilled timestamps. Lesson: a 400 on a list query
is often an unknown/missing **sort or filter field**, not a malformed request.

### `bad-words` default list is narrower than you'd guess

The default dictionary flags `shit`, `crap`, `damn`, `ass`, `hell`, `piss` — but
**not** `bullshit`. Test fixtures need a word that's actually in the list, so the
profanity test uses `crappy shit` rather than assuming any rude phrase trips it.

### Running browser-oriented code (DOMPurify) under Node for seeding

`createNote` → `validateNote` → DOMPurify, which needs a DOM. The seed script
installs a jsdom `window` on `globalThis` **before** dynamically importing the
notes module (DOMPurify binds `window` at import time, so a static import would be
too late). jsdom must be given a real `url` (`https://pb.job-joseph.com`) — its
default `about:blank` is an opaque origin and the PocketBase SDK's
localStorage-backed auth store throws `localStorage is not available` on it.

### Tests run under jsdom

`vitest.config.ts` sets `environment: 'jsdom'` for the same DOMPurify reason; the
validation suite (14 cases) covers limits, profanity, and XSS across all 4 types.
