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
| `author_name` | text     | no       | Display name of the person who wrote it                               |
| `archived`    | bool     | no       | Defaults to `false`; hides note from the main board                   |
| `flagged`     | bool     | no       | Defaults to `false`; user-marked for follow-up                        |

System fields (`id`, `created`, `updated`) are auto-managed by PocketBase.

### Coordinate system

`position_x` and `position_y` are **percentages in the range 0–100**, not absolute
pixels. `position_x` is a percentage of the board's width and `position_y` a
percentage of its height. Storing percentages keeps a note in the same relative
spot on the board regardless of viewport size, so layouts survive window resizes
and translate across screen sizes. The frontend converts to/from pixels at render
and drag time. New notes are seeded at a random position within the 10–80% range
so they don't perfectly stack.

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

### Access rules

All five API rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) are set to `""` (empty string), meaning the collection is **publicly readable and writable**. This is intentional for the initial prototype; tighten before any public deploy.

## `threads` collection — planned (Phase 4)

A second collection records "threads": SVG string connections drawn between two
notes on the desktop canvas (hidden on mobile). It does not exist yet; this is
the intended schema.

### Fields

| Field       | Type     | Required | Notes                                            |
|-------------|----------|----------|--------------------------------------------------|
| `from_note` | relation | yes      | Relation → `notes`; the note the thread starts from |
| `to_note`   | relation | yes      | Relation → `notes`; the note the thread points to   |

System fields (`id`, `created`, `updated`) are auto-managed by PocketBase. The
corresponding `Thread` interface already exists in `src/lib/types.ts`
(`{ id, from_note, to_note }`) ahead of the collection being created.
