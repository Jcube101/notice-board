# SPEC — Data model

## `notes` collection

A single PocketBase collection holds every kind of note. The `type` field discriminates between the four note shapes; the structure of `content` varies by type.

### Fields

| Field         | Type     | Required | Notes                                                                 |
|---------------|----------|----------|-----------------------------------------------------------------------|
| `type`        | select   | yes      | One of: `post-it`, `checklist`, `hot-take`, `recommendation`          |
| `content`     | json     | yes      | Shape depends on `type` (see below)                                   |
| `color`       | text     | no       | Background/accent color (hex or token)                                |
| `position_x`  | number   | no       | X coordinate as a **percentage** (0–100) of the board width — see below |
| `position_y`  | number   | no       | Y coordinate as a **percentage** (0–100) of the board height — see below |
| `author_name` | text     | no       | Display name; a generated placeholder when the author didn't set one  |
| `ip_hash`     | text     | no       | SHA-256 hash of the author's IP, used as an edit credential (see below) |
| `name_was_edited` | bool | no       | Defaults to `false`; `true` once the author sets a real name          |
| `archived`    | bool     | no       | Defaults to `false`; hides note from the main board                   |
| `flagged`     | bool     | no       | Defaults to `false`; user-marked for follow-up                        |
| `reactions`   | json     | no       | Map of emoji → count, e.g. `{ "👋": 3, "🔥": 1 }`; missing ⇒ empty map |

`id` is auto-managed by PocketBase. `created` and `updated` are **`autodate`-type
fields** — once present, PocketBase maintains them automatically (`created` set on
insert, `updated` on every write), but they are **not** added implicitly. When a
collection is created through the REST API they must be declared explicitly; if
omitted, they simply don't exist. This collection was originally created without
them and they were added afterwards via `PATCH /api/collections/notes` (see
`scripts/add-timestamp-fields.sh` and [LEARNINGS.md](LEARNINGS.md)).

### Coordinate system

`position_x` and `position_y` are **percentages in the range 0–100**, not absolute
pixels. `position_x` is a percentage of the board's width and `position_y` a
percentage of its height. Storing percentages keeps a note in the same relative
spot on the board regardless of viewport size, so layouts survive window resizes
and translate across screen sizes. The frontend converts to/from pixels at render
and drag time. New notes are seeded at a random position within the **10–65%**
range so they don't perfectly stack — the upper bound is capped at 65% (rather
than nearer 100%) because notes have real pixel width and would otherwise overflow
the right/bottom edge at narrower viewports.

### Note content — discriminated union

`content` is raw JSON in PocketBase, but the frontend treats it as a TypeScript
discriminated union keyed by `type` (`src/lib/types.ts`). Each `type` pairs with
exactly one `content` shape:

- **post-it** — a short freeform note.
  `{ text: string }`
- **checklist** — an ordered list of checkable items.
  `{ title?: string; items: { text: string; done: boolean }[] }`
- **hot-take** — an opinion or spicy thought.
  `{ text: string; topic?: string }`
- **recommendation** — a recommendation for someone (book, movie, restaurant, etc.).
  `{ title: string; reason: string; category?: string }`

These shapes are conventions enforced by the frontend (types + `validateNote`),
not by PocketBase — the field is raw JSON.

### Validation rules

Enforced client-side by `src/lib/validation.ts` before any write:

- **Profanity** — text is rejected if `bad-words` flags it.
- **XSS** — text is rejected if `dompurify` would strip any HTML/script from it
  (content is expected to be plain text).
- **Character limits:**
  - post-it `text`: ≤ 280 characters
  - hot-take `text`: ≤ 280 characters
  - checklist: ≤ 8 items, each item `text` ≤ 60 characters
  - recommendation `title`: ≤ 140 characters; `reason`: ≤ 140 characters

### Archiving rule

To keep the board bounded, the oldest active note is auto-archived (its
`archived` flag set to `true`) after each create **only when both** conditions
hold (`src/lib/archiving.ts`):

1. there are **more than 10** active (non-archived) notes, **AND**
2. the **oldest** active note is **more than 30 days old** (by `created`).

If either condition is false, nothing is archived.

### Author identity & placeholder names

A note's `author_name` is optional at creation. When it's omitted, `createNote`
generates a friendly placeholder of the form **"Adjective Animal"** (e.g.
"Brave Otter") from two curated lists of 20+ words each, giving 500+ combinations
(`src/lib/placeholder-names.ts`). `name_was_edited` records whether the displayed
name is a real one (`true`) or a generated placeholder (`false`); it lets the UI
distinguish "named by a human" from "auto-assigned". Supplying an explicit name at
creation, or changing it later via `updateNote`, sets `name_was_edited: true`.

### IP hashing (edit credential)

To allow an anonymous author to edit their own note without accounts, the client
derives a lightweight credential from its IP:

1. `getClientIpHash()` fetches the public IP from `https://api.ipify.org?format=json`.
2. It hashes the IP with **SHA-256 via the Web Crypto API** (`crypto.subtle`) and
   returns the lowercase hex digest.
3. Only this hash is stored as `ip_hash` — **the raw IP is never persisted** or
   sent to PocketBase.

This is obfuscation, not strong security (IPs are low-entropy and shared behind
NAT) — appropriate for the prototype's "edit the note you just made" UX, not for
real authorisation.

### Edit permission model

`updateNote(id, ip_hash, updates)` enforces a simple ownership check: it loads the
note, compares the caller's `ip_hash` against the stored one, and **throws
`'Not authorised to edit this note'`** if they differ. On a match it applies
`updates.content` (validated first) and/or `updates.author_name` (which also sets
`name_was_edited: true`). Because the API rules are public, this check is
client-side convenience, not server-enforced — see Access rules below.

### Access rules

All five API rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) are set to `""` (empty string), meaning the collection is **publicly readable and writable**. This is intentional for the initial prototype; tighten before any public deploy.

## Frontend

The frontend (Lovable, in the job-joseph.com repo, served at `/notice-board`) renders the board with two distinct layouts.

### Layouts

- **Desktop — free canvas.** Notes are **absolutely positioned** using the stored
  `position_x` / `position_y` **percentage** coordinates (see Coordinate system).
  Drag and drop is handled by `@dnd-kit`, with `restrictToParentElement` so notes
  can't be dragged off the board. On drop, the new percentage position is written
  back via `updatePosition`.
- **Mobile — masonry.** Positions are ignored; notes flow into a CSS columns
  layout (`columns: 2`) in **created order** (newest first, matching `getNotes`).

### Note size reference

Target **max-width** per note type, to keep the board visually consistent:

| Note type      | Max width |
|----------------|-----------|
| post-it        | 180px     |
| hot-take       | 180px     |
| checklist      | 200px     |
| recommendation | 190px     |

### Z-index model

Stacking order (which note sits on top when notes overlap) is **session-only**: a
**client-side counter map** assigns an incrementing z-index to a note each time it
is dragged, so the most recently moved note comes to the front. This is **not
persisted** to PocketBase — it resets on reload and is intentionally per-session,
so there is no `z_index` field on the `notes` collection.

### Real-time sync

The board subscribes to the `notes` collection over PocketBase's real-time channel
so changes propagate to every visitor live, with no page refresh.

- **Subscribe on mount** — `pb.collection('notes').subscribe('*', handler)`.
- **Events handled** — `create` (add the note to local state), `update` (replace
  it — covers position, reactions, flag, archive), and `delete` (remove it).
  Notes that become archived are dropped from the active board via the `update`
  event.
- **Unsubscribe on unmount** — the effect cleanup must call the returned
  unsubscribe, or subscriptions (and their handlers) leak on every navigation back
  to the board.

### Reactions

Each note carries a `reactions` JSON field: a **map of emoji → count** drawn from a
fixed set of 5 (👋 ❤️ 😂 🔥 💡), e.g. `{ "👋": 3, "🔥": 1 }`. A `null` or missing
field is treated as the empty map `{}`.

- **One reaction type per IP hash per note**, enforced **client-side** using the
  same `ip_hash` credential as edits. There is no server-side uniqueness guarantee
  (the collection is public) — this is convenience, not enforcement.
- Reacting updates the note's `reactions` map and writes it back; the change rides
  the existing notes **subscription**, so counts update live for everyone.

### Admin page

A hidden review page for flagged notes.

- **Route** — `/notice-board/admin`. **Not linked from anywhere** on the site;
  reachable by direct URL only.
- **Password** — a **hardcoded string comparison inside the admin page component**
  (same pattern as the locked journal stories on job-joseph.com). No environment
  variables — `VITE_`-prefixed values are bundled into the client anyway (see
  LEARNINGS.md), so they'd add no real secrecy.
- **Session persistence** — on a correct password the page sets a flag in
  `sessionStorage` (the key is defined in the admin page component) so it isn't
  re-prompted for the rest of the browser session; a wrong entry triggers a shake
  animation.
- **Shows** — all `flagged` notes with content, author, and created date, each with
  an Archive button. Unflagged notes are never shown; an empty state renders when
  nothing is flagged.
