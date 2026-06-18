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
