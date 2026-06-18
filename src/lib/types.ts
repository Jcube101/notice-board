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
