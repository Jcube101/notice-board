# ROADMAP

## Phase 1 — PocketBase setup ✅ Complete

- PocketBase v0.39.4 installed on jobpi (Raspberry Pi, Debian 13 Trixie, aarch64)
- Running as systemd service on `127.0.0.1:8012`
- Exposed via Cloudflare Tunnel at https://pb.job-joseph.com
- `notes` collection created with the schema documented in [SPEC.md](SPEC.md)
- API rules set to public (empty strings) for prototype phase

## Phase 2 — Repo and integration layer ✅ Complete

- Vite + React + TypeScript scaffold
- PocketBase JS SDK client (`src/lib/pocketbase.ts`)
- Typed CRUD data-access layer — list / create / archive / flag / position (`src/lib/notes.ts`)
- Validation: profanity (`bad-words`), XSS (`dompurify`), per-type character limits (`src/lib/validation.ts`)
- Archiving logic — auto-archive the oldest note when crowded and stale (`src/lib/archiving.ts`)
- 14 passing Vitest tests for `validateNote` (`src/lib/__tests__/validation.test.ts`)
- Seed script that creates one note of each type (`scripts/seed.ts`)

## Phase 3 — Lovable frontend build ✅ Complete

Built with Lovable, live on job-joseph.com at the `/notice-board` route.

- **Aesthetic** — cork board with CSS texture, dark walnut surround, Caveat handwritten font
- **Note types** — post-it, checklist, hot-take, recommendation, each rendered per type
- **Desktop** — free canvas with `@dnd-kit` drag and drop, z-index stacking on drag, `restrictToParentElement` boundary enforcement
- **Mobile** — masonry grid layout
- **Add note** — modal with a three-step flow (type → content → color)
- **Authors** — placeholder author names rendered at 50% opacity
- **Editing** — IP-hash based edit permissions
- **Lifecycle** — archive on delete, flag button
- **Entry point** — contact page post-it button linking to `/notice-board`
- **Seed** — 8 seed notes spread across the board

## Phase 4 — Real-time sync ✅ Complete

PocketBase real-time subscription so notes appear and disappear live for all
visitors without a page refresh.

- Subscribes to the `notes` collection on mount
- Handles `create`, `update`, and `delete` events to update local state
- Unsubscribes on component unmount

## Phase 5 — Reactions ✅ Complete

Each note has a small reaction bar with 5 emoji options (👋 ❤️ 😂 🔥 💡).

- Reactions stored as a `reactions` JSON map on the `notes` collection (emoji → count)
- Any visitor can react; one reaction type per IP hash per note, enforced client-side
- Reaction counts update in real time via the Phase 4 subscription

## Phase 6 — Admin review page ✅ Complete

A hidden route at `/notice-board/admin`, not linked from anywhere on the site.

- Hardcoded password gate, with `sessionStorage` session persistence so the
  password isn't re-prompted within a session, and a shake animation on wrong entry
- Lists all flagged notes with content, author, and created date, each with an
  Archive button
- Unflagged notes are not shown; an empty state is rendered when nothing is flagged
