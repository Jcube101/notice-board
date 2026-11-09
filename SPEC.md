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

### Edit keys

Until November 2026 the edit credential was `ip_hash`, a SHA-256 hash of the
author's IP fetched from api.ipify.org. The hashes were publicly readable and an
IPv4 hash can be reversed in minutes, so the field was deleted and the board no
longer looks up or stores anything about a visitor's IP. Edit rights now come
from a random key per note:

1. When posting, the browser makes a random 32-byte key (64 hex characters) and
   picks the note's id itself (15 characters, `a-z0-9`).
2. It sends the note and a `note_keys` record (`{ note, key }`) in **one batch
   request** (`POST /api/batch`), which PocketBase runs as a single transaction.
   Nobody can see the note before its key exists.
3. The browser keeps the key in localStorage (`noticeboard:edit-keys`) and sends
   it as an `X-Edit-Key` header to edit or take down the note.

A hidden field on `notes` doesn't work for this: PocketBase drops hidden fields
from non-superuser requests and from `@request.body`, so a visitor's key would
be stored empty.

### `note_keys` collection

| Field     | Type     | Notes                                           |
|-----------|----------|-------------------------------------------------|
| `note`    | relation | → `notes`, required, single, cascade delete     |
| `key`     | text     | required, exactly 64 lowercase hex characters   |
| `created` | autodate | set on create                                   |

A unique index on `note` allows one key per note. List, view, update and delete
are superuser-only. Create is allowed only for a note created in the last minute
that isn't archived:

```
note.created >= strftime('%Y-%m-%d %H:%M:%fZ', 'now', '-1 minutes') && note.archived = false
```

### Access rules

Locked in November 2026. Moderators sign in with an account in the `moderators`
auth collection (no public sign-up). Batch requests are enabled, 2 per batch.

- **list / view:** active notes for anyone; archived notes for moderators only.
- **create:** anyone, as long as the note isn't archived or flagged; moderators
  can create anything.
- **update:** anyone can move, react, flag (never unflag) and archive notes
  older than 30 days. Whoever holds a note's key
  (`note_keys_via_note.key ?= @request.headers.x_edit_key`) can also edit its
  content or name and take it down. Moderators can change anything.
- **delete:** moderators only.

The exact rule strings live in `build_rules()` in
[`scripts/noticeboard/lockdown.py`](https://github.com/Jcube101/job-joseph/blob/main/scripts/noticeboard/lockdown.py) in the job-joseph repo. Change
them there, since the script tests them on a throwaway copy before applying
them. Content checks (profanity, HTML, length) still run only in the browser.

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

- **One reaction type per visitor per note**, remembered in the browser's
  localStorage (`noticeboard:reactions`). There is no server-side uniqueness
  guarantee: the API rules let anyone change `reactions` — this is convenience,
  not enforcement.
- Reacting updates the note's `reactions` map and writes it back; the change rides
  the existing notes **subscription**, so counts update live for everyone.

### Admin page

A hidden review page for flagged notes.

- **Route** — `/notice-board/admin`. **Not linked from anywhere** on the site;
  reachable by direct URL only.
- **Login** — email and password for an account in the `moderators` auth
  collection, checked by PocketBase (`authWithPassword`). Until November 2026 this
  was a hardcoded password compared in the browser, which shipped in the public
  JavaScript. The PocketBase SDK keeps the login in localStorage until the
  moderator signs out; a wrong login shows an error and a shake animation.
- **Permissions** — the notes API rules give a moderator account full access, so
  the Archive button works for any note. Visitors can't do any of this.
- **Shows** — all `flagged` notes with content, author, and created date, each with
  an Archive button. Unflagged notes are never shown; an empty state renders when
  nothing is flagged.
