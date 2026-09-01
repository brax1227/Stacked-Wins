import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { stackService, LANES } from '../services/stackService';
import type { StackKind, RankMove } from '../services/stackService';

/**
 * The full list, per lane, and the only place ranking happens.
 *
 * It's the user's data, so hiding it would be a lie -- but nothing in the app
 * navigates here on its own, and you never land here. It exists for the
 * moment someone wants proof the pile is finite, or wants to say "that one
 * first". Working still happens one card at a time on /now.
 *
 * Ranking is deliberately quarantined to this screen. Dump order is the
 * default everywhere else, and nothing anywhere blocks on a card being
 * ranked: a sort you're *required* to do before the app deals you a card
 * would rebuild the exact freeze this product exists to break. See PROBLEM.md.
 */
export const StackPage = () => {
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<StackKind>('need');

  const { data, isLoading } = useQuery({
    queryKey: ['stack', kind],
    queryFn: () => stackService.getStack(kind),
  });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['stack'] });
    queryClient.invalidateQueries({ queryKey: ['stackNext'] });
  };

  const rank = useMutation({
    mutationFn: ({ id, move }: { id: string; move: RankMove }) => stackService.rank(id, move),
    onSuccess: refresh,
  });

  const relane = useMutation({
    mutationFn: ({ id, to }: { id: string; to: StackKind }) => stackService.setKind(id, to),
    onSuccess: refresh,
  });

  const drop = useMutation({
    mutationFn: (id: string) => stackService.drop(id),
    onSuccess: refresh,
  });

  const items = data?.items ?? [];
  const busy = rank.isPending || relane.isPending || drop.isPending;
  const otherLane: StackKind = kind === 'need' ? 'want' : 'need';

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Everything</h1>
        <Link to="/now" className="text-sm text-primary-700 hover:text-primary-800">
          back to one at a time
        </Link>
      </div>

      <div className="mt-6 flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
        {LANES.map((lane) => (
          <button
            key={lane.kind}
            type="button"
            onClick={() => setKind(lane.kind)}
            aria-pressed={kind === lane.kind}
            className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
              kind === lane.kind
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {lane.label}
            {data?.lanes?.[lane.kind] ? (
              <span className="ml-2 text-gray-400">{data.lanes[lane.kind]}</span>
            ) : null}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="mt-8 text-gray-400">One second…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-gray-500">
          Nothing in this lane.{' '}
          <Link to="/dump" className="text-primary-700 hover:text-primary-800">
            Add something
          </Link>
          .
        </p>
      ) : (
        <>
          {/* The count belongs here and only here: the point of this screen is
              that the pile has edges and can be counted. */}
          <p className="mt-6 text-sm text-gray-500">
            {items.length} {items.length === 1 ? 'thing' : 'things'}, in the order
            you'll see them. Move what matters to the top.
          </p>
          <ul className="mt-6 divide-y divide-gray-100 bg-white rounded-xl shadow-sm">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-3 p-4">
                <span className="text-sm text-gray-300 tabular-nums w-6 shrink-0">
                  {index + 1}
                </span>

                <span className="flex-1 text-gray-900">
                  {item.title}
                  {item.snoozedUntil && (
                    <span className="ml-2 text-xs text-gray-400">sleeping until tomorrow</span>
                  )}
                </span>

                <div className="flex items-center gap-1 shrink-0">
                  <RankButton
                    label="↑"
                    title="Move up"
                    disabled={busy || index === 0}
                    onClick={() => rank.mutate({ id: item.id, move: 'up' })}
                  />
                  <RankButton
                    label="↓"
                    title="Move down"
                    disabled={busy || index === items.length - 1}
                    onClick={() => rank.mutate({ id: item.id, move: 'down' })}
                  />
                  <button
                    type="button"
                    disabled={busy || index === 0}
                    onClick={() => rank.mutate({ id: item.id, move: 'top' })}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-primary-700 disabled:opacity-30"
                  >
                    do first
                  </button>
                </div>

                <div className="flex items-center gap-2 shrink-0 border-l border-gray-100 pl-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => relane.mutate({ id: item.id, to: otherLane })}
                    className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                    aria-label={`Move ${item.title} to ${otherLane === 'need' ? 'Need to' : 'Want to'}`}
                  >
                    → {otherLane === 'need' ? 'need' : 'want'}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => drop.mutate(item.id)}
                    className="text-xs text-gray-400 hover:text-gray-700 disabled:opacity-40"
                    aria-label={`Let go of ${item.title}`}
                  >
                    let go
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};

const RankButton = ({
  label,
  title,
  onClick,
  disabled,
}: {
  label: string;
  title: string;
  onClick: () => void;
  disabled: boolean;
}) => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onClick={onClick}
    className="w-7 h-7 rounded-md text-gray-400 hover:bg-gray-100 hover:text-gray-900 disabled:opacity-25 disabled:hover:bg-transparent transition-colors"
  >
    {label}
  </button>
);
