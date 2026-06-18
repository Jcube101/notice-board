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
