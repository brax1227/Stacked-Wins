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
    .replace(/&#x27;/g, "'");

describe('NowPage', () => {
  beforeEach(() => {
    queryState.isLoading = false;
  });

  it('shows the one card and none of the others', () => {
    queryState.data = {
      item: { id: 'item-1', title: 'call the bank', pushCount: 0 },
      suggestSplit: false,
      remaining: 17,
      sleeping: 3,
      done: 5,
    };

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
    queryState.data = {
      item: { id: 'item-1', title: 'laundry', pushCount: 0 },
      suggestSplit: false,
      remaining: 4,
      sleeping: 0,
      done: 0,
    };

    const html = render();

    expect(html).toContain('Done');
    expect(html).toContain('Not now');
    expect(html).toContain('Not today');
    expect(html).toContain('Too big');
  });

  it('nudges toward a split once a card keeps cycling', () => {
    queryState.data = {
      item: { id: 'item-1', title: 'sort out the car situation', pushCount: 4 },
      suggestSplit: true,
      remaining: 4,
      sleeping: 0,
      done: 0,
    };

    expect(render()).toContain('bigger than one thing');
  });

  it('lands calmly when the stack is clear, and says where sleeping cards went', () => {
    queryState.data = {
      item: null,
      suggestSplit: false,
      remaining: 0,
      sleeping: 2,
      done: 7,
    };

    const html = render();

    expect(html).toContain("That's everything.");
    expect(html).toContain('2 cards are waiting for tomorrow');
    expect(html).toContain('Add something');
    // No move buttons when there is no card to move.
    expect(html).not.toContain('Not today');
  });

  it('does not flash an empty state while the first card is loading', () => {
    queryState.data = undefined;
    queryState.isLoading = true;

    expect(render()).not.toContain("That's everything.");
  });
});
