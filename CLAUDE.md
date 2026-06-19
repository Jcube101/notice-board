# CLAUDE.md

Context for Claude Code when working in this repo.

## Backend

- **PocketBase URL:** https://pb.job-joseph.com
- **Collection:** `notes` (single collection holds all four note types, discriminated by the `type` field — see [SPEC.md](SPEC.md))
- **API rules:** all five (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) are `""` — the collection is **publicly readable and writable** with no auth required. Frontend can hit the API directly with no token.

## Repo intent

Prototype phase. Treat the public API rules as a deliberate choice, not an oversight — do not add auth gates or proxy layers unless explicitly asked.

## Gotchas worth knowing

- **Autodate fields:** the `notes` collection did not get `created`/`updated` automatically — PocketBase does not add them implicitly when a collection is created via the REST API. They were added explicitly via [scripts/add-timestamp-fields.sh](scripts/add-timestamp-fields.sh). Any new API-created collection needs the same.
- **Profanity tests:** `bad-words` does **not** flag `bullshit`. The validation tests use `crappy shit` as a verified trigger; pick a known-listed word if writing new profanity assertions.
- **New note positions:** `createNote` seeds each new note at a random position between **10–65%** on both axes (`position_x` / `position_y` are percentages), so fresh notes don't perfectly stack. The 65% cap (not higher) keeps wide notes from overflowing the board edge at narrower viewports.
- **IP hashing:** `ip_hash` is a **SHA-256 hash of the client IP** (fetched from `api.ipify.org`, hashed client-side via Web Crypto). **Raw IPs are never stored** — only the hash. It's used as a lightweight edit credential in `updateNote`, not as real auth.
- **Re-seeding:** seed notes can be re-run via [scripts/seed.ts](scripts/seed.ts) (`npm run seed`). It **archives** the existing notes before creating new ones — it never hard-deletes.
- **Reactions field:** reactions live as a `reactions` **JSON map** on the `notes` collection, e.g. `{ '👋': 3, '🔥': 1 }` (emoji → count). A `null` or missing `reactions` field must be treated as an **empty map** `{}`, not an error. Like the autodate and `ip_hash` fields, it was **added in a separate patch after the initial schema** — the initial collection creation via curl does not add it automatically (see [scripts/add-reactions-field.sh](scripts/add-reactions-field.sh)).
- **Real-time subscription:** the PocketBase subscription is set up in the board component **on mount** and **must be unsubscribed on unmount** to avoid memory leaks (a new subscription accumulates on every navigation back to the board otherwise).
- **Admin page route:** the admin page lives at `/notice-board/admin` and is **not linked from anywhere** on the site — access is by direct URL only.
- **Admin password:** the gate is a **hardcoded string comparison inside the admin page component** (same pattern as the locked journal stories in job-joseph.com). No environment variables are involved — see the LEARNINGS note on why `VITE_`-prefixed vars aren't secret.

## Frontend

The UI for this project does **not** live in this repo. It was built with Lovable and lives in the **job-joseph.com** repo:

- `src/lib/noticeboard/` — a mirror of this repo's `src/lib/` modules
- `src/pages/Noticeboard/` — the React page/components, served at the `/notice-board` route

This repo's `src/lib/` is the source of truth for the data layer. **Any change to a `src/lib/` file here must be manually mirrored** into `src/lib/noticeboard/` in the job-joseph.com repo (the pre-commit hook below reminds you, and [MIGRATION.md](MIGRATION.md) is a copy-paste snapshot to make that easier).

**Note sizing targets** (max-width per type, for visual consistency on the board):

| Note type      | Max width |
|----------------|-----------|
| post-it        | 180px     |
| hot-take       | 180px     |
| checklist      | 200px     |
| recommendation | 190px     |

## Git hooks

- **`pre-commit` sync reminder:** a versioned pre-commit hook lives at [scripts/hooks/pre-commit](scripts/hooks/pre-commit). Whenever a commit touches files under `src/lib/`, it prints a warning that those modules are mirrored in **(a)** the job-joseph.com repo under `src/lib/noticeboard/` and **(b)** [MIGRATION.md](MIGRATION.md) at the repo root, then **sleeps 5 seconds** (Ctrl+C to cancel, or wait to proceed). This is expected behaviour — a committed `src/lib/` change pausing for 5s is the hook, not a hang. If the same commit doesn't also stage `MIGRATION.md`, it adds an extra "may now be out of date" warning so that snapshot can't silently drift.
- **Installation:** the hook is wired up via `core.hooksPath` (not `.git/hooks/`), so it **is** version-controlled. Run [scripts/install-hooks.sh](scripts/install-hooks.sh) (or `npm run install-hooks`) once after cloning; it also runs automatically via npm's `prepare` lifecycle on `npm install`. Keep all three `src/lib/` copies (here, the job-joseph.com mirror, and MIGRATION.md) in sync.

See [README.md](README.md), [SPEC.md](SPEC.md), [ROADMAP.md](ROADMAP.md), [LEARNINGS.md](LEARNINGS.md) for the rest.
