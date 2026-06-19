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
validation suite covers limits, profanity, and XSS across all 4 types.

## Phase 2.x — IP edit permissions & placeholder names

### Adding more fields is the same PATCH dance

`ip_hash` (text, optional) and `name_was_edited` (bool) were added to the live
collection with `scripts/add-ip-fields.sh` — same flow as the autodate migration
(auth → GET collection → append to `fields` → PATCH). PocketBase **bool fields
have no configurable default**; an unset bool simply reads as `false`, which is
the "default false" the spec wanted, so nothing extra is needed.

### Mocking the PocketBase client in Vitest

`updateNote` hits PocketBase (`getOne` then `update`), so the auth-check tests mock
the client. `vi.mock` is hoisted above imports, so the spies it references must be
created with `vi.hoisted(() => ({ getOne: vi.fn(), update: vi.fn() }))` — declaring
them as plain `const` below the mock factory hits the temporal dead zone. The
module under test is then pulled in with a post-mock `await import('../notes')`.

### `crypto.subtle` is the Web Crypto entry point

`getClientIpHash` hashes with `crypto.subtle.digest('SHA-256', …)` and hex-encodes
the resulting `ArrayBuffer` via `Array.from(new Uint8Array(buf)).map(b =>
b.toString(16).padStart(2,'0')).join('')`. `subtle` is only available on secure
origins (https / localhost) in the browser; Node 20+ exposes it globally too.

### IP hashing is obfuscation, not auth

Hashing the IP keeps raw IPs out of the DB, but it's weak as an access control:
IPs are low-entropy (brute-forceable) and shared behind NAT, so two people on the
same network would share an `ip_hash`. Fine for "edit the note you just made" in a
prototype; not a real permission system. The API rules remain public, so the check
is client-side convenience only.

## Phase 3 — Lovable frontend

### Lovable added thumbtack pins unprompted

Lovable generated SVG thumbtack pins on each note without being asked — a welcome
surprise that fit the cork-board aesthetic.

### `overflow: hidden` on the board is essential

Without `overflow: hidden` on the board container, wide notes **bleed past the
edges at tablet viewports**. Clipping the container is what keeps the canvas
looking contained between the mobile and desktop breakpoints.

### Z-index stacking must be a client-side counter, not stored

Bringing the most-recently-dragged note to the front needs an incrementing
z-index. This is **session-specific**, so it lives in a client-side counter map
rather than a persisted field — storing it would be meaningless across sessions
and would add a pointless `z_index` column.

### Percentage positions break at the right/bottom edge for wide notes

Storing positions as percentages keeps notes relative across viewports, but a note
anchored at e.g. 80% still has real pixel width, so wide notes **overflow at the
boundary**. The safe-zone cap for new/dragged notes should be **~65%, not 80%**.
Acted on: `createNote` now caps seeded positions at **10–65%** (was 10–80%), and
the frontend drag safe-zone in the Lovable repo was tightened to match.

### Caveat loads reliably in Lovable with no manual font setup

The Caveat handwritten font from Google Fonts just works inside Lovable — no manual
`@font-face`, preload, or config needed.

## Phases 4–6 — real-time, reactions, admin

### PocketBase `subscribe` needs a matching `unsubscribe` on unmount

`pb.collection('notes').subscribe(...)` opens a live connection; if the board
component doesn't **unsubscribe on unmount**, a new subscription accumulates every
time you navigate back, leaking memory (and duplicating event handlers). Easy to
miss because it "works" in dev until you navigate around. Return the unsubscribe
from the effect cleanup.

### `VITE_`-prefixed env vars are baked into the client bundle — not secret

Anything `VITE_*` is inlined into the built JS at build time and shipped to the
browser, so it is **not** a secret. For a simple admin gate on a personal project,
a hardcoded password string compared in the component is more honest about the
threat model (it's obscurity either way) and avoids pretending an env var adds
security. That's the pattern used here and for the locked journal stories on
job-joseph.com.

### Lovable's Secrets panel doesn't change that

Lovable exposes a Secrets panel under the Cloud tab, but for **client-side** values
the `VITE_` bundling still applies — they end up in the bundle regardless. The
Secrets panel is for server-side use; it doesn't make a client-read value secret.

### Reactions as a JSON map avoid a whole collection

Storing reactions as a `reactions` JSON map (`{ emoji: count }`) directly on the
`notes` record means **no separate collection, no relations, no extra fetch** — the
counts ride along with the note and update through the same real-time subscription.
Keeps the schema flat. Treat a missing/`null` field as `{}`.
