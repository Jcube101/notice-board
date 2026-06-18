# src/lib/pocketbase.ts

```ts
import PocketBase from 'pocketbase';

/**
 * Base URL of the self-hosted PocketBase instance.
 * The `notes` collection is publicly readable/writable in the prototype phase,
 * so no auth token is attached to the client (see CLAUDE.md / SPEC.md).
 */
export const POCKETBASE_URL = 'https://pb.job-joseph.com';

export const pb = new PocketBase(POCKETBASE_URL);

export default pb;
```

# src/lib/types.ts

```ts
/**
 * Type definitions for the notice-board data model.
 *
 * A single PocketBase `notes` collection holds every kind of note. The `type`
 * field discriminates between the four note shapes, and `content` is a JSON
 * field whose shape depends on `type` (see SPEC.md).
 */

/** The four kinds of note, used as the discriminant on both Note and NoteContent. */
export type NoteType = 'post-it' | 'checklist' | 'hot-take' | 'recommendation';

/** A short freeform note. */
export interface PostItContent {
  text: string;
}

/** A single row in a checklist. */
export interface ChecklistItem {
  text: string;
  done: boolean;
}

/** An ordered list of checkable items (max 8 items, see validation.ts). */
export interface ChecklistContent {
  title?: string;
  items: ChecklistItem[];
}

/** An opinion or spicy thought. */
export interface HotTakeContent {
  text: string;
  topic?: string;
}

/** A recommendation for someone (book, movie, restaurant, etc.). */
export interface RecommendationContent {
  title: string;
  reason: string;
  category?: string;
}

/**
 * Discriminated union of the `content` payloads, keyed by note `type`.
 * Each member carries the matching `type` so a Note can be narrowed by it.
 */
export type NoteContent =
  | { type: 'post-it'; content: PostItContent }
  | { type: 'checklist'; content: ChecklistContent }
  | { type: 'hot-take'; content: HotTakeContent }
  | { type: 'recommendation'; content: RecommendationContent };

/** Maps a NoteType to its corresponding content shape. */
export type ContentFor<T extends NoteType> = Extract<
  NoteContent,
  { type: T }
>['content'];

/**
 * Fields common to every note, independent of `type`.
 * `position_x` / `position_y` are percentages (0–100) of the board canvas.
 */
interface NoteBase {
  id: string;
  /** Background/accent color (hex or design token). */
  color: string;
  /** X coordinate as a percentage (0–100) of the board width. */
  position_x: number;
  /** Y coordinate as a percentage (0–100) of the board height. */
  position_y: number;
  /** Display name of the person who wrote it (a generated placeholder if unset). */
  author_name: string;
  /**
   * SHA-256 hash of the author's IP, used as a lightweight edit credential.
   * The raw IP is never stored. Optional: legacy notes may not have it.
   */
  ip_hash?: string;
  /**
   * True once the author has changed `author_name` away from the generated
   * placeholder. Defaults to false.
   */
  name_was_edited?: boolean;
  /** Hidden from the main board when true. */
  archived: boolean;
  /** User-marked for follow-up when true. */
  flagged: boolean;
  /** ISO timestamp, auto-managed by PocketBase. */
  created: string;
  /** ISO timestamp, auto-managed by PocketBase. */
  updated: string;
}

/**
 * A persisted note. The intersection with NoteContent ties `type` to the
 * shape of `content`, so narrowing on `note.type` narrows `note.content`.
 */
export type Note = NoteBase & NoteContent;

/**
 * A directed connection between two notes on the board canvas.
 * Planned for Phase 4 (SVG "threads"); stored in a separate `threads`
 * PocketBase collection with relation fields.
 */
export interface Thread {
  id: string;
  /** Relation: id of the note the thread starts from. */
  from_note: string;
  /** Relation: id of the note the thread points to. */
  to_note: string;
}
```

# src/lib/validation.ts

```ts
import { Filter } from 'bad-words';
import DOMPurify from 'dompurify';
import type {
  ChecklistContent,
  ContentFor,
  HotTakeContent,
  NoteType,
  PostItContent,
  RecommendationContent,
} from './types';

/**
 * Validation for note content: profanity, XSS, and per-type character limits.
 * Exposed primarily through {@link validateNote}, with the individual checks
 * exported for reuse and testing.
 */

/** Per-type character limits, in one place so SPEC.md and code stay in sync. */
export const LIMITS = {
  /** Max length of `text` for post-it notes. */
  POST_IT_TEXT: 280,
  /** Max length of `text` for hot-take notes. */
  HOT_TAKE_TEXT: 280,
  /** Max number of items in a checklist. */
  CHECKLIST_MAX_ITEMS: 8,
  /** Max length of each checklist item's `text`. */
  CHECKLIST_ITEM_TEXT: 60,
  /** Max length of a recommendation `title`. */
  RECOMMENDATION_TITLE: 140,
  /** Max length of a recommendation `reason`. */
  RECOMMENDATION_REASON: 140,
} as const;

const filter = new Filter();

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

const ok: ValidationResult = { valid: true };
const fail = (error: string): ValidationResult => ({ valid: false, error });

/** True when `text` contains any profane word. */
export function hasProfanity(text: string): boolean {
  // `bad-words` throws on empty strings in some versions; short-circuit.
  return text.trim().length > 0 && filter.isProfane(text);
}

/**
 * Strip all HTML/markup from `text`. With no allowed tags or attributes,
 * DOMPurify returns the plain-text content with any script/markup removed.
 */
export function sanitize(text: string): string {
  return DOMPurify.sanitize(text, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
}

/**
 * True when `text` contains markup that sanitization would strip — i.e. the
 * raw input is not already safe plain text.
 */
export function hasUnsafeHtml(text: string): boolean {
  return sanitize(text) !== text;
}

/**
 * Run profanity + XSS checks on a single string under a human-readable label.
 * Returns the first failure, or `ok`.
 */
function checkText(label: string, text: string): ValidationResult {
  if (hasUnsafeHtml(text)) {
    return fail(`${label} contains HTML or script that is not allowed.`);
  }
  if (hasProfanity(text)) {
    return fail(`${label} contains inappropriate language.`);
  }
  return ok;
}

function validatePostIt(content: PostItContent): ValidationResult {
  const text = content?.text ?? '';
  if (text.trim().length === 0) return fail('Post-it text cannot be empty.');
  if (text.length > LIMITS.POST_IT_TEXT) {
    return fail(`Post-it text exceeds ${LIMITS.POST_IT_TEXT} characters.`);
  }
  return checkText('Post-it text', text);
}

function validateHotTake(content: HotTakeContent): ValidationResult {
  const text = content?.text ?? '';
  if (text.trim().length === 0) return fail('Hot-take text cannot be empty.');
  if (text.length > LIMITS.HOT_TAKE_TEXT) {
    return fail(`Hot-take text exceeds ${LIMITS.HOT_TAKE_TEXT} characters.`);
  }
  return checkText('Hot-take text', text);
}

function validateChecklist(content: ChecklistContent): ValidationResult {
  const items = content?.items ?? [];
  if (items.length === 0) return fail('A checklist needs at least one item.');
  if (items.length > LIMITS.CHECKLIST_MAX_ITEMS) {
    return fail(`A checklist can have at most ${LIMITS.CHECKLIST_MAX_ITEMS} items.`);
  }
  for (let i = 0; i < items.length; i++) {
    const text = items[i]?.text ?? '';
    if (text.trim().length === 0) {
      return fail(`Checklist item ${i + 1} cannot be empty.`);
    }
    if (text.length > LIMITS.CHECKLIST_ITEM_TEXT) {
      return fail(
        `Checklist item ${i + 1} exceeds ${LIMITS.CHECKLIST_ITEM_TEXT} characters.`,
      );
    }
    const result = checkText(`Checklist item ${i + 1}`, text);
    if (!result.valid) return result;
  }
  if (content.title) {
    const result = checkText('Checklist title', content.title);
    if (!result.valid) return result;
  }
  return ok;
}

function validateRecommendation(content: RecommendationContent): ValidationResult {
  const title = content?.title ?? '';
  const reason = content?.reason ?? '';
  if (title.trim().length === 0) return fail('Recommendation title cannot be empty.');
  if (title.length > LIMITS.RECOMMENDATION_TITLE) {
    return fail(`Recommendation title exceeds ${LIMITS.RECOMMENDATION_TITLE} characters.`);
  }
  if (reason.trim().length === 0) return fail('Recommendation reason cannot be empty.');
  if (reason.length > LIMITS.RECOMMENDATION_REASON) {
    return fail(`Recommendation reason exceeds ${LIMITS.RECOMMENDATION_REASON} characters.`);
  }
  const titleResult = checkText('Recommendation title', title);
  if (!titleResult.valid) return titleResult;
  return checkText('Recommendation reason', reason);
}

/**
 * Validate note content for a given type. Runs, in order, character-limit
 * checks, XSS sanitization checks, and a profanity filter across every
 * user-supplied string in the payload.
 *
 * @returns `{ valid: true }` or `{ valid: false, error }` with the first problem found.
 */
export function validateNote<T extends NoteType>(
  type: T,
  content: ContentFor<T>,
): ValidationResult {
  switch (type) {
    case 'post-it':
      return validatePostIt(content as PostItContent);
    case 'hot-take':
      return validateHotTake(content as HotTakeContent);
    case 'checklist':
      return validateChecklist(content as ChecklistContent);
    case 'recommendation':
      return validateRecommendation(content as RecommendationContent);
    default:
      return fail(`Unknown note type: ${String(type)}`);
  }
}
```

# src/lib/archiving.ts

```ts
/**
 * Board archiving policy.
 *
 * To keep the board from growing without bound, the oldest active note is
 * auto-archived once the board is both *crowded* and *stale*: there are more
 * than 10 active notes AND the oldest of them is more than 30 days old.
 */

/** Number of active notes above which the board is considered crowded. */
export const MAX_ACTIVE_NOTES = 10;

/** Age (in days) beyond which the oldest note is considered stale. */
export const MAX_AGE_DAYS = 30;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Decide whether the oldest active note should be archived.
 *
 * @param activeCount  Number of non-archived notes currently on the board.
 * @param oldestCreated  ISO timestamp of the oldest active note's `created` field.
 * @param now  Reference time; defaults to the current time (injectable for tests).
 * @returns `true` only if there are more than {@link MAX_ACTIVE_NOTES} active
 *          notes AND the oldest is more than {@link MAX_AGE_DAYS} days old.
 */
export function shouldArchiveOldest(
  activeCount: number,
  oldestCreated: string,
  now: Date = new Date(),
): boolean {
  if (activeCount <= MAX_ACTIVE_NOTES) return false;

  const oldest = new Date(oldestCreated).getTime();
  if (Number.isNaN(oldest)) return false;

  const ageDays = (now.getTime() - oldest) / MS_PER_DAY;
  return ageDays > MAX_AGE_DAYS;
}
```

# src/lib/notes.ts

```ts
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
  // Spread new notes around the canvas so they don't perfectly stack. Cap the
  // range at 65% (not higher): notes have real pixel width, so anything anchored
  // further right/down overflows the board edge at narrower viewports.
  return {
    position_x: Math.round(10 + Math.random() * 55),
    position_y: Math.round(10 + Math.random() * 55),
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
```

# src/lib/placeholder-names.ts

```ts
/**
 * Generates friendly placeholder display names for anonymous authors, e.g.
 * "Brave Otter". Used when a note is created without an explicit `author_name`.
 */

const ADJECTIVES = [
  'Brave',
  'Curious',
  'Witty',
  'Gentle',
  'Bold',
  'Cosmic',
  'Mellow',
  'Nimble',
  'Quirky',
  'Sunny',
  'Clever',
  'Jolly',
  'Plucky',
  'Swift',
  'Dapper',
  'Wise',
  'Zesty',
  'Breezy',
  'Fuzzy',
  'Lucky',
  'Spry',
  'Snazzy',
  'Cheerful',
  'Radiant',
] as const;

const ANIMALS = [
  'Otter',
  'Fox',
  'Panda',
  'Heron',
  'Lynx',
  'Badger',
  'Falcon',
  'Koala',
  'Marmot',
  'Octopus',
  'Penguin',
  'Raccoon',
  'Sparrow',
  'Tapir',
  'Walrus',
  'Yak',
  'Gecko',
  'Hedgehog',
  'Ibex',
  'Newt',
  'Quokka',
  'Wombat',
  'Pangolin',
  'Capybara',
] as const;

function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)];
}

/**
 * Return a random "Adjective Animal" name. With {@link ADJECTIVES} and
 * {@link ANIMALS} each ≥ 20 long, there are 500+ combinations.
 */
export function generatePlaceholderName(): string {
  return `${pick(ADJECTIVES)} ${pick(ANIMALS)}`;
}
```
