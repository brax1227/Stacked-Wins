import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { renderToString } from 'react-dom/server';

// Why:
// - Lock in the Daily Plan progress UI so the progress ring label
//   doesn't get visually duplicated/overlapped.

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@tanstack/react-query', () => {
  const tasks = [
    {
      id: 'task-1',
      title: 'One',
      estimatedMinutes: 5,
      isAnchorWin: true,
      category: 'mental',
      order: 0,
      completed: false,
    },
    {
      id: 'task-2',
      title: 'Two',
      estimatedMinutes: 5,
      isAnchorWin: false,
      category: 'mental',
      order: 1,
      completed: false,
    },
  ];

  return {
    useQuery: () => ({
      data: tasks,
      isLoading: false,
      error: null,
    }),
    useMutation: () => ({
      mutate: vi.fn(),
      isPending: false,
    }),
    useQueryClient: () => ({
      invalidateQueries: vi.fn(),
    }),
  };
});

// Imported after mocks
import { DailyPlanPage } from './DailyPlanPage';

describe('DailyPlanPage', () => {
  it('renders progress percent once and shows wins count below', () => {
    const html = renderToString(<DailyPlanPage />);
    const normalized = html.replace(/<!-- -->/g, '');

    // ProgressRing includes percent label (0% for 0/2 completed)
    expect(normalized).toContain('0%');

    // Wins count should be a separate line (not overlapped in the ring)
    expect(normalized).toContain('of 2 wins');

    // Old overlapped UI used a large centered count overlay.
    expect(normalized).not.toContain('text-3xl font-bold text-gray-900');
  });
});

