/**
 * Pure helpers for the stack (no database access).
 *
 * The stack is the pile the user dumped out of their head. These helpers
 * handle the two things that need to be exactly right and are worth testing
 * on their own: turning a raw brain dump into clean items, and deciding
 * which cards are askable today.
 *
 * See PROBLEM.md for why the product works this way.
 */

export const MAX_TITLE_LENGTH = 500;
export const MAX_DUMP_ITEMS = 200;

/**
 * The two lanes: things you have to do, and things you want to do.
 *
 * One binary choice per dump session -- not a category applied per item, and
 * never a gate. An unspecified lane falls back to 'need' so a dump can always
 * go through without a decision.
 */
export const KINDS = ['need', 'want'];
export const DEFAULT_KIND = 'need';

export function normalizeKind(raw) {
  return KINDS.includes(raw) ? raw : DEFAULT_KIND;
}

/**
 * A lane filter for queries. `all` means both lanes.
 */
export function kindFilter(raw) {
  return raw === 'all' ? {} : { kind: normalizeKind(raw) };
}

/**
 * Turn a raw brain dump into a clean list of titles.
 *
 * Accepts either a blob of text (one thing per line) or an array of strings.
 * Deliberately forgiving: people dumping their head type fast, paste from
 * notes apps, and leave bullet characters and blank lines everywhere. None
 * of that should cost them anything.
 */
export function parseDump(input) {
  const lines = Array.isArray(input)
    ? input
    : String(input ?? '').split(/\r?\n/);

  const seen = new Set();
  const titles = [];

  for (const line of lines) {
    const title = normalizeTitle(line);
    if (!title) continue;

    // Dedupe within a single dump only. If the same thing is genuinely on
    // your mind twice, you typed it twice in one sitting by accident.
    const key = title.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    titles.push(title);
    if (titles.length >= MAX_DUMP_ITEMS) break;
  }

  return titles;
}

/**
 * Clean a single line into a card title, or return null if there's nothing
 * left worth keeping.
 */
export function normalizeTitle(raw) {
  if (typeof raw !== 'string') return null;

  const title = raw
    // Strip leading list markers people paste in: "- ", "* ", "1. ", "[ ] "
    .replace(/^\s*(?:[-*•]|\d+[.)]|\[\s*[xX]?\s*\])\s*/, '')
    .trim()
    .slice(0, MAX_TITLE_LENGTH);

  return title.length > 0 ? title : null;
}

/**
 * Today at midnight, matching the date-only column the snooze uses.
 */
export function startOfToday(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

/**
 * Tomorrow at midnight. Where "Not today" sends a card.
 */
export function startOfTomorrow(now = new Date()) {
  const today = startOfToday(now);
  today.setUTCDate(today.getUTCDate() + 1);
  return today;
}

/**
 * The Prisma `where` for cards that can be dealt right now: still open, and
 * not sleeping off a "Not today". Pass a lane to deal from one of them, or
 * 'all' for both.
 */
export function askableWhere(userId, kind = 'all', now = new Date()) {
  return {
    userId,
    ...kindFilter(kind),
    status: 'open',
    OR: [
      { snoozedUntil: null },
      { snoozedUntil: { lte: startOfToday(now) } },
    ],
  };
}

/**
 * A card that keeps getting pushed is usually not being avoided -- it's
 * several tasks wearing a trench coat. After a few pushes we suggest
 * breaking it down rather than letting it cycle forever.
 */
export const PUSHES_BEFORE_SPLIT_HINT = 3;

export function shouldSuggestSplit(item) {
  return Boolean(item) && (item.pushCount ?? 0) >= PUSHES_BEFORE_SPLIT_HINT;
}
