import { describe, it, expect } from '@jest/globals';
import {
  parseDump,
  normalizeTitle,
  askableWhere,
  startOfToday,
  startOfTomorrow,
  shouldSuggestSplit,
  MAX_DUMP_ITEMS,
  MAX_TITLE_LENGTH,
} from '../src/services/stackService.js';

// Why:
// - The dump is the moment the user is most overwhelmed. Anything it rejects
//   or mangles is a thing that stays stuck in their head, so parsing has to
//   be forgiving in every way a fast, messy dump can be messy.

describe('parseDump', () => {
  it('turns a blob of text into one card per line', () => {
    expect(parseDump('call the bank\nlaundry\nemail advisor')).toEqual([
      'call the bank',
      'laundry',
      'email advisor',
    ]);
  });

  it('accepts an array as well as a text blob', () => {
    expect(parseDump(['laundry', 'dishes'])).toEqual(['laundry', 'dishes']);
  });

  it('drops blank lines and surrounding whitespace', () => {
    expect(parseDump('  laundry  \n\n\n   \ndishes\n')).toEqual(['laundry', 'dishes']);
  });

  it('strips list markers pasted in from notes apps', () => {
    const dumped = parseDump('- laundry\n* dishes\n1. taxes\n2) rent\n[ ] gym\n[x] call mom\n• oil change');
    expect(dumped).toEqual(['laundry', 'dishes', 'taxes', 'rent', 'gym', 'call mom', 'oil change']);
  });

  it('handles windows line endings', () => {
    expect(parseDump('laundry\r\ndishes')).toEqual(['laundry', 'dishes']);
  });

  it('dedupes case-insensitively within one dump', () => {
    expect(parseDump('Laundry\nlaundry\nLAUNDRY\ndishes')).toEqual(['Laundry', 'dishes']);
  });

  it('returns nothing for empty, whitespace-only, or missing input', () => {
    expect(parseDump('')).toEqual([]);
    expect(parseDump('   \n\n  ')).toEqual([]);
    expect(parseDump(undefined)).toEqual([]);
    expect(parseDump(null)).toEqual([]);
  });

  it('caps a single dump so one paste cannot flood the stack', () => {
    const huge = Array.from({ length: MAX_DUMP_ITEMS + 50 }, (_, i) => `thing ${i}`);
    expect(parseDump(huge)).toHaveLength(MAX_DUMP_ITEMS);
  });

  it('truncates a very long line rather than rejecting it', () => {
    const [title] = parseDump('x'.repeat(MAX_TITLE_LENGTH + 100));
    expect(title).toHaveLength(MAX_TITLE_LENGTH);
  });
});

describe('normalizeTitle', () => {
  it('returns null for anything that is not a usable string', () => {
    expect(normalizeTitle('')).toBeNull();
    expect(normalizeTitle('   ')).toBeNull();
    expect(normalizeTitle('- ')).toBeNull();
    expect(normalizeTitle(42)).toBeNull();
    expect(normalizeTitle(undefined)).toBeNull();
  });

  it('keeps meaningful punctuation inside a title', () => {
    expect(normalizeTitle('call mom - ask about thanksgiving')).toBe(
      'call mom - ask about thanksgiving'
    );
  });
});

describe('snooze dates', () => {
  it('startOfTomorrow is exactly one day after startOfToday', () => {
    const now = new Date('2026-03-14T22:41:00Z');
    expect(startOfToday(now).toISOString()).toBe('2026-03-14T00:00:00.000Z');
    expect(startOfTomorrow(now).toISOString()).toBe('2026-03-15T00:00:00.000Z');
  });

  it('rolls over month boundaries', () => {
    expect(startOfTomorrow(new Date('2026-01-31T12:00:00Z')).toISOString()).toBe(
      '2026-02-01T00:00:00.000Z'
    );
  });
});

describe('askableWhere', () => {
  it('asks for open cards that are not sleeping', () => {
    const where = askableWhere('user-123', new Date('2026-03-14T22:41:00Z'));
    expect(where.userId).toBe('user-123');
    expect(where.status).toBe('open');
    // Never snoozed, or the snooze has already come due.
    expect(where.OR).toEqual([
      { snoozedUntil: null },
      { snoozedUntil: { lte: new Date('2026-03-14T00:00:00.000Z') } },
    ]);
  });
});

describe('shouldSuggestSplit', () => {
  it('stays quiet until a card has been pushed several times', () => {
    expect(shouldSuggestSplit({ pushCount: 0 })).toBe(false);
    expect(shouldSuggestSplit({ pushCount: 2 })).toBe(false);
  });

  it('offers the split once a card keeps cycling', () => {
    expect(shouldSuggestSplit({ pushCount: 3 })).toBe(true);
    expect(shouldSuggestSplit({ pushCount: 9 })).toBe(true);
  });

  it('is safe when there is no card at all', () => {
    expect(shouldSuggestSplit(null)).toBe(false);
    expect(shouldSuggestSplit(undefined)).toBe(false);
  });
});
