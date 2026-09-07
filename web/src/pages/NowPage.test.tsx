import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderToString } from 'react-dom/server';

// Why:
// - The one-card contract IS the product (PROBLEM.md). A full list on screen
//   recreates the exact overwhelm the app exists to remove, so these lock in
//   that /now shows one card and never leaks the size of the pile.

vi.mock('react-router-dom', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
  useNavigate: () => vi.fn(),
}));

const queryState = {
  data: undefined as unknown,
  isLoading: false,
};

const withLanes = (over: Record<string, unknown>) => ({
  suggestSplit: false,
  remaining: 0,
  sleeping: 0,
  done: 0,
  kind: 'need',
  lanes: { need: 0, want: 0 },
  ...over,
});

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: queryState.data, isLoading: queryState.isLoading, error: null }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

// Imported after mocks
import { NowPage } from './NowPage';

// renderToString escapes apostrophes; decode so assertions can read as copy.
const render = () =>
  renderToString(<NowPage />)
    .replace(/<!-- -->/g, '')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"');

describe('NowPage', () => {
  beforeEach(() => {
    queryState.isLoading = false;
  });

  it('shows the one card and none of the others', () => {
    queryState.data = withLanes({
      item: { id: 'item-1', title: 'call the bank', kind: 'need', pushCount: 0 },
      remaining: 17,
      sleeping: 3,
      done: 5,
      lanes: { need: 17, want: 4 },
    });

    const html = render();

    expect(html).toContain('call the bank');

    // The size of the pile is exactly what freezes the user. It must never
    // appear on this screen -- not as a count, not as "3 of 17".
    expect(html).not.toContain('17');
    expect(html).not.toContain('remaining');
    expect(html).not.toContain('left');

    // No list markup on the card screen.
    expect(html).not.toContain('<ul');
    expect(html).not.toContain('<li');
  });

  it('offers exactly the four moves', () => {
    queryState.data = withLanes({
      item: { id: 'item-1', title: 'laundry', kind: 'need', pushCount: 0 },
      remaining: 4,
      lanes: { need: 4, want: 0 },
    });

    const html = render();

    expect(html).toContain('Done');
    expect(html).toContain('Not now');
    expect(html).toContain('Not today');
    expect(html).toContain('Too big');
  });

  it('nudges toward a split once a card keeps cycling', () => {
    queryState.data = withLanes({
      item: { id: 'item-1', title: 'sort out the car situation', kind: 'need', pushCount: 4 },
      suggestSplit: true,
      remaining: 4,
      lanes: { need: 4, want: 0 },
    });

    expect(render()).toContain('bigger than one thing');
  });

  it('lands calmly when the stack is clear, and says where sleeping cards went', () => {
    queryState.data = withLanes({
      item: null,
      sleeping: 2,
      done: 7,
    });

    const html = render();

    expect(html).toContain('Nothing you have to do.');
    expect(html).toContain('2 cards are waiting for tomorrow');
    expect(html).toContain('Add something');
    // No move buttons when there is no card to move.
    expect(html).not.toContain('Not today');
  });

  it('does not flash an empty state while the first card is loading', () => {
    queryState.data = undefined;
    queryState.isLoading = true;

    expect(render()).not.toContain('Nothing you have to do.');
  });

  describe('the two lanes', () => {
    it('offers both lanes, and puts no counts on either tab', () => {
      queryState.data = withLanes({
        item: { id: 'item-1', title: 'laundry', kind: 'need', pushCount: 0 },
        remaining: 17,
        lanes: { need: 17, want: 4 },
      });

      const html = render();

      expect(html).toContain('Need to');
      expect(html).toContain('Want to');
      // A badge on the tab is the pile leaking onto the card screen.
      expect(html).not.toContain('>17<');
      expect(html).not.toContain('>4<');
    });

    it('sends you to the want lane once the needs are clear', () => {
      queryState.data = withLanes({ item: null, lanes: { need: 0, want: 3 } });

      const html = render();

      expect(html).toContain('Go do something you want to');
      // Still no number attached to it.
      expect(html).not.toContain('3 ');
    });

    it('asks you to add something when both lanes are empty', () => {
      queryState.data = withLanes({ item: null, lanes: { need: 0, want: 0 } });

      const html = render();

      expect(html).toContain('Add something');
      expect(html).not.toContain('Go do something you want to');
    });

    it('lets a card be moved to the other lane without spending a move', () => {
      queryState.data = withLanes({
        item: { id: 'item-1', title: 'read that book', kind: 'need', pushCount: 0 },
        remaining: 2,
        lanes: { need: 2, want: 0 },
      });

      const html = render();

      // A quiet link, not a fifth button competing with the four moves.
      expect(html).toContain('this belongs in "Want to"');
      expect(html).not.toContain('rounded-xl border-2 border-gray-200 text-gray-600 font-medium">this belongs');
    });
  });
});
