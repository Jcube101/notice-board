/**
 * Seed one note of each type into the live PocketBase at pb.job-joseph.com.
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

const { createNote } = await import('../src/lib/notes.ts');
const { getNotes } = await import('../src/lib/notes.ts');

async function seed() {
  console.log('Seeding sample notes into PocketBase…\n');

  const postIt = await createNote(
    'post-it',
    { text: 'Stopped by from the link in your bio — love this little board. Keep it up! 👋' },
    '#FFE066',
    'A passing visitor',
  );
  console.log(`  post-it        ${postIt.id}`);

  const checklist = await createNote(
    'checklist',
    {
      title: 'Weekend grocery run',
      items: [
        { text: 'Oat milk', done: false },
        { text: 'Sourdough loaf', done: false },
        { text: 'Cherry tomatoes', done: true },
        { text: 'Dark chocolate (the good kind)', done: false },
        { text: 'Coffee beans', done: false },
      ],
    },
    '#A0E7A0',
    'Sam',
  );
  console.log(`  checklist      ${checklist.id}`);

  const hotTake = await createNote(
    'hot-take',
    {
      text: 'Dark mode is overrated. Most apps just invert their colors badly and call it a feature — good light themes are harder and almost nobody ships one.',
      topic: 'design',
    },
    '#FF6B6B',
    'Riley',
  );
  console.log(`  hot-take       ${hotTake.id}`);

  const recommendation = await createNote(
    'recommendation',
    {
      title: 'The Three-Body Problem (Liu Cixin)',
      reason: 'Hardest sci-fi I have read in years — the scope keeps escalating in ways you do not see coming.',
      category: 'book',
    },
    '#6BB6FF',
    'Jordan',
  );
  console.log(`  recommendation ${recommendation.id}`);

  // Verify the four notes are now live in the collection.
  console.log('\nVerifying against the live collection…');
  const ids = new Set([postIt.id, checklist.id, hotTake.id, recommendation.id]);
  const active = await getNotes();
  const found = active.filter((n) => ids.has(n.id));
  console.log(`  ${found.length}/4 seeded notes present (collection has ${active.length} active notes total).`);

  if (found.length !== 4) {
    throw new Error('Not all seeded notes were found in the collection.');
  }
  console.log('\n✅ Seed complete.');
}

seed().catch((err) => {
  console.error('\n❌ Seed failed:', err);
  process.exit(1);
});
