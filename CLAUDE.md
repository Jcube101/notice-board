# CLAUDE.md

Context for Claude Code when working in this repo.

## Backend

- **PocketBase URL:** https://pb.job-joseph.com
- **Collection:** `notes` (single collection holds all four note types, discriminated by the `type` field — see [SPEC.md](SPEC.md))
- **API rules:** all five (`listRule`, `viewRule`, `createRule`, `updateRule`, `deleteRule`) are `""` — the collection is **publicly readable and writable** with no auth required. Frontend can hit the API directly with no token.

## Repo intent

Prototype phase. Treat the public API rules as a deliberate choice, not an oversight — do not add auth gates or proxy layers unless explicitly asked.

See [README.md](README.md), [SPEC.md](SPEC.md), [ROADMAP.md](ROADMAP.md), [LEARNINGS.md](LEARNINGS.md) for the rest.
