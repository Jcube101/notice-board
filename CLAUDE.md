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

See [README.md](README.md), [SPEC.md](SPEC.md), [ROADMAP.md](ROADMAP.md), [LEARNINGS.md](LEARNINGS.md) for the rest.
