# notice-board

A digital corkboard for capturing notes, checklists, hot takes, and recommendations. Notes are free-positioned on a 2D canvas and persisted to a self-hosted PocketBase instance.

## Tech stack

- **Backend**: [PocketBase](https://pocketbase.io) (self-hosted on Raspberry Pi)
- **Frontend**: React + Vite + TypeScript
- **Styling**: Tailwind CSS + [shadcn/ui](https://ui.shadcn.com)

## Project status

- **Phase 1 — PocketBase setup ✅ Complete** — `notes` collection live on a self-hosted instance.
- **Phase 2 — Integration layer ✅ Complete** — Vite + React + TS scaffold, PocketBase client, typed CRUD, validation, archiving logic, 14 passing tests, seed script.
- **Phase 3 — Frontend build 🚧 In progress.**
- **Phase 4 — Threads ⏳ Planned.**

See [ROADMAP.md](ROADMAP.md) for the full breakdown.

## Backend

PocketBase API: **https://pb.job-joseph.com**

See [SPEC.md](SPEC.md) for the data model.

## Integration layer (`src/lib`)

The typed integration layer that the frontend builds on:

- **`pocketbase.ts`** — initialises and exports the PocketBase JS SDK client pointed at the API. No auth token; the collection is public in the prototype phase.
- **`types.ts`** — TypeScript types for the data model: the `Note` discriminated union (one `content` shape per note `type`) and the `Thread` interface (Phase 4).
- **`validation.ts`** — `validateNote(type, content)` runs a profanity filter (`bad-words`), XSS sanitization (`dompurify`), and per-type character limits, returning `{ valid, error? }`.
- **`archiving.ts`** — `shouldArchiveOldest(activeCount, oldestCreated)` decides whether the oldest note should be auto-archived (more than 10 active notes **and** the oldest older than 30 days).
- **`notes.ts`** — the typed async CRUD layer: `getNotes`, `createNote` (validates, then applies the archiving rule), `archiveNote`, `flagNote`, `updatePosition`.

## Development

Install dependencies and run the dev server:

```bash
npm install
npm run dev
```

### Tests

Unit tests for the validation layer run under Vitest (in a jsdom environment, since
DOMPurify needs a DOM):

```bash
npm test
```

### Seeding sample data

Populate the live collection with one note of each type:

```bash
npm run seed
```

The seed script runs in Node, so it sets up a jsdom `window` before importing the
validation layer (DOMPurify binds to `window` at import time).

## Gotcha — PocketBase autodate fields

When creating a collection through the PocketBase REST API, the `created` and
`updated` timestamp fields are **not** added implicitly — they are `autodate`
fields you must include explicitly. Phase 1 created `notes` without them, which
broke sorting by `-created` and the archiving age check. They were added after the
fact with [scripts/add-timestamp-fields.sh](scripts/add-timestamp-fields.sh). If you
spin up a new collection via the API, add the autodate fields up front.
