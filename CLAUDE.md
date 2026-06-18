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
- **New note positions:** `createNote` seeds each new note at a random position between **10–80%** on both axes (`position_x` / `position_y` are percentages), so fresh notes don't perfectly stack.
- **IP hashing:** `ip_hash` is a **SHA-256 hash of the client IP** (fetched from `api.ipify.org`, hashed client-side via Web Crypto). **Raw IPs are never stored** — only the hash. It's used as a lightweight edit credential in `updateNote`, not as real auth.

## Git hooks

- **`pre-commit` sync reminder:** a versioned pre-commit hook lives at [scripts/hooks/pre-commit](scripts/hooks/pre-commit). Whenever a commit touches files under `src/lib/`, it prints a warning that those modules are mirrored in **(a)** the job-joseph.com repo under `src/lib/noticeboard/` and **(b)** [MIGRATION.md](MIGRATION.md) at the repo root, then **sleeps 5 seconds** (Ctrl+C to cancel, or wait to proceed). This is expected behaviour — a committed `src/lib/` change pausing for 5s is the hook, not a hang. If the same commit doesn't also stage `MIGRATION.md`, it adds an extra "may now be out of date" warning so that snapshot can't silently drift.
- **Installation:** the hook is wired up via `core.hooksPath` (not `.git/hooks/`), so it **is** version-controlled. Run [scripts/install-hooks.sh](scripts/install-hooks.sh) (or `npm run install-hooks`) once after cloning; it also runs automatically via npm's `prepare` lifecycle on `npm install`. Keep all three `src/lib/` copies (here, the job-joseph.com mirror, and MIGRATION.md) in sync.

See [README.md](README.md), [SPEC.md](SPEC.md), [ROADMAP.md](ROADMAP.md), [LEARNINGS.md](LEARNINGS.md) for the rest.
