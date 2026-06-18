import { pb } from './pocketbase';
import { shouldArchiveOldest } from './archiving';
import { validateNote } from './validation';
import { generatePlaceholderName } from './placeholder-names';
import type { ContentFor, Note, NoteContent, NoteType } from './types';

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
 * If `author_name` is omitted (or blank), a random "Adjective Animal" placeholder
 * is generated and `name_was_edited` is stored as `false`; when the caller
 * supplies a name, it is stored as-is with `name_was_edited: true`. The optional
 * `ip_hash` is kept as a lightweight edit credential (see {@link updateNote}).
 *
 * Throws if validation fails. After a successful create, applies the archiving
 * policy: if the board is now crowded and its oldest active note is stale, that
 * oldest note is archived automatically (see {@link shouldArchiveOldest}).
 */
export async function createNote<T extends NoteType>(
  type: T,
  content: ContentFor<T>,
  color: string,
  author_name?: string,
  ip_hash?: string,
): Promise<Note> {
  const result = validateNote(type, content);
  if (!result.valid) {
    throw new Error(result.error ?? 'Invalid note content.');
  }

  const hasName = typeof author_name === 'string' && author_name.trim().length > 0;
  const resolvedName = hasName ? author_name! : generatePlaceholderName();

  const created = await pb.collection(COLLECTION).create<Note>({
    type,
    content,
    color,
    author_name: resolvedName,
    name_was_edited: hasName,
    archived: false,
    flagged: false,
    ...defaultPosition(),
    ...(ip_hash ? { ip_hash } : {}),
  });

  await archiveOldestIfNeeded();

  return created;
}

/**
 * Update a note's content and/or author name, gated by the IP-hash credential.
 *
 * The caller must pass the `ip_hash` of the requesting client; it must match the
 * `ip_hash` stored on the note or the update is refused. When `author_name` is
 * changed, `name_was_edited` is set to `true`. New `content`, if provided, is
 * validated first.
 *
 * @throws Error `'Not authorised to edit this note'` if the hashes don't match.
 */
export async function updateNote(
  id: string,
  ip_hash: string,
  updates: { content?: NoteContent; author_name?: string },
): Promise<Note> {
  const note = await pb.collection(COLLECTION).getOne<Note>(id);

  if (note.ip_hash !== ip_hash) {
    throw new Error('Not authorised to edit this note');
  }

  const data: Record<string, unknown> = {};

  if (updates.content) {
    const result = validateNote(updates.content.type, updates.content.content);
    if (!result.valid) {
      throw new Error(result.error ?? 'Invalid note content.');
    }
    data.type = updates.content.type;
    data.content = updates.content.content;
  }

  if (updates.author_name !== undefined) {
    data.author_name = updates.author_name;
    data.name_was_edited = true;
  }

  return pb.collection(COLLECTION).update<Note>(id, data);
}

/**
 * Fetch the client's public IP from api.ipify.org and return its SHA-256 hash as
 * a lowercase hex string, computed client-side via the Web Crypto API. The raw
 * IP is never stored — only this hash is persisted (as `ip_hash`).
 */
export async function getClientIpHash(): Promise<string> {
  const res = await fetch('https://api.ipify.org?format=json');
  const { ip } = (await res.json()) as { ip: string };

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ip));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
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
