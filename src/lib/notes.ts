import { pb } from './pocketbase';
import { shouldArchiveOldest } from './archiving';
import { validateNote } from './validation';
import type { ContentFor, Note, NoteType } from './types';

/**
 * Typed data-access layer for the `notes` collection.
 *
 * All calls hit PocketBase directly with no auth token — the collection is
 * public in the prototype phase (see CLAUDE.md). Each helper returns or
 * accepts the strongly typed {@link Note} shape.
 */

const COLLECTION = 'notes';

/** A freshly created note's default board position (percentage coordinates). */
function defaultPosition(): { position_x: number; position_y: number } {
  // Spread new notes around the canvas so they don't perfectly stack.
  return {
    position_x: Math.round(10 + Math.random() * 70),
    position_y: Math.round(10 + Math.random() * 70),
  };
}

/** Fetch all non-archived notes, newest first. */
export async function getNotes(): Promise<Note[]> {
  return pb.collection(COLLECTION).getFullList<Note>({
    filter: 'archived = false',
    sort: '-created',
  });
}

/**
 * Create a note after validating its content.
 *
 * Throws if validation fails. After a successful create, applies the archiving
 * policy: if the board is now crowded and its oldest active note is stale, that
 * oldest note is archived automatically (see {@link shouldArchiveOldest}).
 */
export async function createNote<T extends NoteType>(
  type: T,
  content: ContentFor<T>,
  color: string,
  author_name: string,
): Promise<Note> {
  const result = validateNote(type, content);
  if (!result.valid) {
    throw new Error(result.error ?? 'Invalid note content.');
  }

  const created = await pb.collection(COLLECTION).create<Note>({
    type,
    content,
    color,
    author_name,
    archived: false,
    flagged: false,
    ...defaultPosition(),
  });

  await archiveOldestIfNeeded();

  return created;
}

/**
 * Apply the archiving policy to the current board: archive the oldest active
 * note when there are too many and the oldest is too old. No-op otherwise.
 */
async function archiveOldestIfNeeded(): Promise<void> {
  const active = await getNotes(); // sorted newest-first
  if (active.length === 0) return;

  const oldest = active[active.length - 1];
  if (shouldArchiveOldest(active.length, oldest.created)) {
    await archiveNote(oldest.id);
  }
}

/** Mark a note as archived (hidden from the main board). */
export async function archiveNote(id: string): Promise<Note> {
  return pb.collection(COLLECTION).update<Note>(id, { archived: true });
}

/** Mark a note as flagged for follow-up. */
export async function flagNote(id: string): Promise<Note> {
  return pb.collection(COLLECTION).update<Note>(id, { flagged: true });
}

/**
 * Overwrite a note's board position.
 * @param position_x  X coordinate as a percentage (0–100) of the board width.
 * @param position_y  Y coordinate as a percentage (0–100) of the board height.
 */
export async function updatePosition(
  id: string,
  position_x: number,
  position_y: number,
): Promise<Note> {
  return pb.collection(COLLECTION).update<Note>(id, { position_x, position_y });
}
