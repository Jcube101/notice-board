import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validateNote } from '../validation';
import type {
  ChecklistContent,
  ChecklistItem,
  HotTakeContent,
  Note,
  PostItContent,
  RecommendationContent,
} from '../types';

// Mock the PocketBase client so updateNote's auth logic can be tested without a
// network call. `vi.hoisted` lets the factory reference these spies safely.
const { getOne, update } = vi.hoisted(() => ({
  getOne: vi.fn(),
  update: vi.fn(),
}));
vi.mock('../pocketbase', () => ({
  pb: { collection: () => ({ getOne, update }) },
}));

// Imported after the mock is registered.
const { updateNote } = await import('../notes');

/** A known profanity reliably flagged by `bad-words`. */
const PROFANITY = 'This is some crappy shit advice';
/** A classic XSS payload. */
const XSS = 'Hello <script>alert("xss")</script> world';

describe('validateNote — post-it', () => {
  it('passes a valid note within 280 chars', () => {
    const content: PostItContent = { text: 'Welcome to the board! Have a great day.' };
    expect(validateNote('post-it', content)).toEqual({ valid: true });
  });

  it('fails a note exceeding 280 chars', () => {
    const content: PostItContent = { text: 'a'.repeat(281) };
    const result = validateNote('post-it', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/280 characters/);
  });

  it('fails a note containing profanity', () => {
    const content: PostItContent = { text: PROFANITY };
    const result = validateNote('post-it', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/inappropriate language/);
  });

  it('fails a note containing an XSS script tag', () => {
    const content: PostItContent = { text: XSS };
    const result = validateNote('post-it', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/HTML or script/);
  });
});

describe('validateNote — hot-take', () => {
  it('passes a valid note within 280 chars', () => {
    const content: HotTakeContent = { text: 'Tabs are objectively better than spaces.' };
    expect(validateNote('hot-take', content)).toEqual({ valid: true });
  });

  it('fails a note exceeding 280 chars', () => {
    const content: HotTakeContent = { text: 'a'.repeat(281) };
    const result = validateNote('hot-take', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/280 characters/);
  });

  it('fails a note containing profanity', () => {
    const content: HotTakeContent = { text: PROFANITY };
    const result = validateNote('hot-take', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/inappropriate language/);
  });

  it('fails a note containing an XSS script tag', () => {
    const content: HotTakeContent = { text: XSS };
    const result = validateNote('hot-take', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/HTML or script/);
  });
});

describe('validateNote — checklist', () => {
  const item = (text: string): ChecklistItem => ({ text, done: false });

  it('passes a valid list of 3 items within 60 chars each', () => {
    const content: ChecklistContent = {
      title: 'Groceries',
      items: [item('Milk'), item('Bread'), item('Eggs')],
    };
    expect(validateNote('checklist', content)).toEqual({ valid: true });
  });

  it('fails with more than 8 items', () => {
    const content: ChecklistContent = {
      items: Array.from({ length: 9 }, (_, i) => item(`Item ${i + 1}`)),
    };
    const result = validateNote('checklist', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/at most 8 items/);
  });

  it('fails when an item exceeds 60 chars', () => {
    const content: ChecklistContent = {
      items: [item('Milk'), item('b'.repeat(61))],
    };
    const result = validateNote('checklist', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/60 characters/);
  });
});

describe('validateNote — recommendation', () => {
  it('passes a valid title and reason within 140 chars each', () => {
    const content: RecommendationContent = {
      title: 'Dune',
      reason: 'A sweeping sci-fi epic with unforgettable world-building.',
    };
    expect(validateNote('recommendation', content)).toEqual({ valid: true });
  });

  it('fails when the title exceeds 140 chars', () => {
    const content: RecommendationContent = {
      title: 'a'.repeat(141),
      reason: 'Great read.',
    };
    const result = validateNote('recommendation', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/title exceeds 140 characters/);
  });

  it('fails when the reason exceeds 140 chars', () => {
    const content: RecommendationContent = {
      title: 'Dune',
      reason: 'a'.repeat(141),
    };
    const result = validateNote('recommendation', content);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/reason exceeds 140 characters/);
  });
});

describe('updateNote — ip_hash authorisation', () => {
  /** A stored note with a known ip_hash credential. */
  const storedNote = {
    id: 'note123',
    type: 'post-it',
    content: { text: 'original' },
    ip_hash: 'matching-hash',
    author_name: 'Brave Otter',
    name_was_edited: false,
  } as unknown as Note;

  beforeEach(() => {
    getOne.mockReset();
    update.mockReset();
    getOne.mockResolvedValue(storedNote);
    update.mockImplementation((id: string, data: Record<string, unknown>) =>
      Promise.resolve({ ...storedNote, ...data, id }),
    );
  });

  it('allows the update when the ip_hash matches', async () => {
    const result = await updateNote('note123', 'matching-hash', {
      author_name: 'Real Name',
    });

    expect(update).toHaveBeenCalledWith('note123', {
      author_name: 'Real Name',
      name_was_edited: true,
    });
    expect(result.author_name).toBe('Real Name');
    expect(result.name_was_edited).toBe(true);
  });

  it('throws and skips the write when the ip_hash does not match', async () => {
    await expect(
      updateNote('note123', 'wrong-hash', { author_name: 'Intruder' }),
    ).rejects.toThrow('Not authorised to edit this note');

    expect(update).not.toHaveBeenCalled();
  });
});
