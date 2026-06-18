/**
 * Reset the board: archive every existing note, then seed 8 new notes placed at
 * fixed positions across the canvas (positions are percentages, 0–100).
 *
 * Existing notes are ARCHIVED, never deleted.
 *
 * Run with:  npm run seed   (or: npx tsx scripts/seed.ts)
 *
 * The validation layer uses DOMPurify, which needs a DOM. This script runs in
 * Node, so we install a jsdom `window` global *before* importing the notes
 * module (DOMPurify binds to `window` at import time). The dynamic import below
 * guarantees that ordering.
 */
import { JSDOM } from 'jsdom';

// A concrete URL gives the document a real origin, so the PocketBase SDK's
// localStorage-backed auth store works (an opaque `about:blank` origin throws).
const { window } = new JSDOM('', { url: 'https://pb.job-joseph.com' });
// DOMPurify (via src/lib/validation.ts) looks up the global `window` on import.
(globalThis as unknown as { window: Window }).window = window as unknown as Window;

const { pb } = await import('../src/lib/pocketbase.ts');
const { createNote, archiveNote, updatePosition, getNotes } = await import('../src/lib/notes.ts');
import type { NoteContent } from '../src/lib/types.ts';

/** A note to seed, with its fixed board position (percentages). */
interface SeedNote {
  type: NoteContent['type'];
  content: NoteContent['content'];
  color: string;
  author: string;
  x: number;
  y: number;
}

const SEED_NOTES: SeedNote[] = [
  {
    type: 'post-it',
    color: '#FFE066', // yellow
    author: 'A passing visitor',
    content: { text: 'Stopped by from the link in your bio — love this little board. Keep it up! 👋' },
    x: 8,
    y: 10,
  },
  {
    type: 'checklist',
    color: '#A0E7A0',
    author: 'Sam',
    content: {
      title: 'Weekend grocery run',
      items: [
        { text: 'Oat milk', done: false },
        { text: 'Sourdough loaf', done: false },
        { text: 'Cherry tomatoes', done: false },
        { text: 'Dark chocolate (the good kind)', done: false },
        { text: 'Coffee beans', done: false },
      ],
    },
    x: 38,
    y: 8,
  },
  {
    type: 'hot-take',
    color: '#FF6B6B',
    author: 'Riley',
    content: {
      text: 'Dark mode is overrated. Most apps just invert their colors badly and call it a feature — good light themes are harder and almost nobody ships one.',
    },
    x: 65,
    y: 5,
  },
  {
    type: 'recommendation',
    color: '#6BB6FF',
    author: 'Jordan',
    content: {
      title: 'The Three-Body Problem (Liu Cixin)',
      reason: 'Hardest sci-fi I have read in years — the scope keeps escalating in ways you do not see coming.',
    },
    x: 5,
    y: 52,
  },
  {
    type: 'post-it',
    color: '#FF8FAB', // pink
    author: 'Curious Penguin',
    content: { text: 'What stack did you build this with? It feels really native.' },
    x: 32,
    y: 55,
  },
  {
    type: 'hot-take',
    color: '#FF6B6B',
    author: 'Restless Falcon',
    content: {
      text: 'Notion killed the personal website. Everyone just pastes a Notion link and calls it a portfolio now. Build your own things.',
    },
    x: 58,
    y: 48,
  },
  {
    type: 'recommendation',
    color: '#6BB6FF',
    author: 'Wandering Elk',
    content: {
      title: 'Thinking Fast and Slow — Kahneman',
      reason: 'Changes how you second-guess yourself. Read it slowly.',
    },
    x: 20,
    y: 25,
  },
  {
    type: 'post-it',
    color: '#6BB6FF', // blue
    author: 'Mellow Tortoise',
    content: { text: 'Found you through the F1 fantasy tool. Genuinely useful, nice work.' },
    x: 72,
    y: 55,
  },
];

async function seed() {
  // 1. Archive every existing note (never delete). Fetch the full list including
  //    already-archived ones, and archive any that are still active.
  console.log('Archiving existing notes…');
  const existing = await pb.collection('notes').getFullList<{ id: string; archived: boolean }>();
  const active = existing.filter((n) => !n.archived);
  for (const note of active) {
    await archiveNote(note.id);
  }
  console.log(`  archived ${active.length} active note(s) (${existing.length} total in collection).\n`);

  // 2. Create the 8 new notes, then set each one's exact position.
  console.log('Seeding 8 new notes…');
  const created: { id: string; type: string; author: string; x: number; y: number }[] = [];
  for (const def of SEED_NOTES) {
    const note = await createNote(def.type, def.content as never, def.color, def.author);
    const placed = await updatePosition(note.id, def.x, def.y);
    created.push({
      id: placed.id,
      type: def.type,
      author: def.author,
      x: placed.position_x,
      y: placed.position_y,
    });
    console.log(`  ${def.type.padEnd(14)} ${placed.id}  (${placed.position_x}, ${placed.position_y})  ${def.author}`);
  }

  // 3. Verify all 8 are live with the positions we set.
  console.log('\nVerifying against the live collection…');
  const live = await getNotes();
  const liveById = new Map(live.map((n) => [n.id, n]));

  let mismatches = 0;
  for (const c of created) {
    const note = liveById.get(c.id);
    if (!note) {
      console.error(`  ❌ ${c.id} (${c.type}) not found in active notes`);
      mismatches++;
      continue;
    }
    if (note.position_x !== c.x || note.position_y !== c.y) {
      console.error(
        `  ❌ ${c.id} (${c.type}) position is (${note.position_x}, ${note.position_y}), expected (${c.x}, ${c.y})`,
      );
      mismatches++;
    }
  }

  const seededLive = created.filter((c) => liveById.has(c.id)).length;
  console.log(`  ${seededLive}/8 seeded notes live; ${live.length} active notes on the board total.`);

  if (seededLive !== 8 || mismatches > 0) {
    throw new Error('Verification failed: not all 8 notes are live with the expected positions.');
  }

  console.log('\n✅ Seed complete — board reset to 8 positioned notes.');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
