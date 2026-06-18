# ROADMAP

## Phase 1 — PocketBase setup ✅ Complete

- PocketBase v0.39.4 installed on jobpi (Raspberry Pi, Debian 13 Trixie, aarch64)
- Running as systemd service on `127.0.0.1:8012`
- Exposed via Cloudflare Tunnel at https://pb.job-joseph.com
- `notes` collection created with the schema documented in [SPEC.md](SPEC.md)
- API rules set to public (empty strings) for prototype phase

## Phase 2 — Repo and integration layer 🚧 In progress

- Scaffold repo with documentation
- Vite + React + TypeScript project initialised
- Wire up PocketBase JS SDK client (`src/lib/pocketbase.ts`)
- Type definitions for the four note `content` shapes (`src/lib/types.ts`)
- Validation: profanity (`bad-words`), XSS (`dompurify`), per-type char limits (`src/lib/validation.ts`)
- Archiving policy helper (`src/lib/archiving.ts`)
- Thin, typed data-access layer — list / create / archive / flag / position (`src/lib/notes.ts`)

## Phase 3 — Lovable frontend build ⏳ Upcoming

- Vite + React + TS + Tailwind + shadcn/ui app
- Canvas board with drag-positioned notes
- Per-type note components (post-it, checklist, hot-take, recommendation)
- Color picker, archive view, flagged view
- Author attribution and basic filtering

## Phase 4 — Threads ⏳ Planned

- SVG string connections between notes on the desktop canvas
- Stored in a `threads` PocketBase collection with `from_note` and `to_note` relation fields
- Hidden on mobile
