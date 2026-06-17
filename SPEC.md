# SPEC — Data model

## `notes` collection

A single PocketBase collection holds every kind of note. The `type` field discriminates between the four note shapes; the structure of `content` varies by type.

### Fields

| Field         | Type     | Required | Notes                                                                 |
|---------------|----------|----------|-----------------------------------------------------------------------|
| `type`        | select   | yes      | One of: `post-it`, `checklist`, `hot-take`, `recommendation`          |
| `content`     | json     | yes      | Shape depends on `type` (see below)                                   |
| `color`       | text     | no       | Background/accent color (hex or token)                                |
| `position_x`  | number   | no       | X coordinate on the board canvas                                      |
| `position_y`  | number   | no       | Y coordinate on the board canvas                                      |
| `author_name` | text     | no       | Display name of the person who wrote it                               |
| `archived`    | bool     | no       | Defaults to `false`; hides note from the main board                   |
| `flagged`     | bool     | no       | Defaults to `false`; user-marked for follow-up                        |

System fields (`id`, `created`, `updated`) are auto-managed by PocketBase.

### Note types

- **post-it** — a short freeform note. `content` likely `{ "text": "..." }`.
- **checklist** — an ordered list of items with done state. `content` likely `{ "title": "...", "items": [{ "text": "...", "done": false }] }`.
- **hot-take** — an opinion or spicy thought. `content` likely `{ "text": "...", "topic": "..." }`.
- **recommendation** — a recommendation for someone (book, movie, restaurant, etc.). `content` likely `{ "title": "...", "category": "...", "notes": "..." }`.

These `content` shapes are conventions enforced by the frontend, not by PocketBase — the field is raw JSON.

### Access rules

All five API rules (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) are set to `""` (empty string), meaning the collection is **publicly readable and writable**. This is intentional for the initial prototype; tighten before any public deploy.
