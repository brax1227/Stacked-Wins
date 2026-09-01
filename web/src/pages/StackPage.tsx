import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { stackService } from '../services/stackService';

/**
 * The full list.
 *
 * It's the user's data, so hiding it would be a lie -- but nothing in the app
 * navigates here on its own, and you never land here. It exists for the
 * moment someone wants proof the pile is finite, not as a place to work
 * from. Working happens one card at a time on /now. See PROBLEM.md.
 */
export const StackPage = () => {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['stack'],
    queryFn: () => stackService.getStack('open'),
  });

  const drop = useMutation({
    mutationFn: (id: string) => stackService.drop(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stack'] });
      queryClient.invalidateQueries({ queryKey: ['stackNext'] });
    },
  });

  const items = data?.items ?? [];

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold text-gray-900">Everything</h1>
        <Link to="/now" className="text-sm text-primary-700 hover:text-primary-800">
          back to one at a time
        </Link>
      </div>

      {isLoading ? (
        <p className="mt-8 text-gray-400">One second…</p>
      ) : items.length === 0 ? (
        <p className="mt-8 text-gray-500">
          Nothing in your stack.{' '}
          <Link to="/dump" className="text-primary-700 hover:text-primary-800">
            Add something
          </Link>
          .
        </p>
      ) : (
        <>
          {/* The count belongs here and only here: the point of this screen is
              that the pile has edges and can be counted. */}
          <p className="mt-2 text-sm text-gray-500">
            {items.length} {items.length === 1 ? 'thing' : 'things'}, in the order
            you'll see them.
          </p>
          <ul className="mt-8 divide-y divide-gray-100 bg-white rounded-xl shadow-sm">
            {items.map((item, index) => (
              <li key={item.id} className="flex items-center gap-4 p-4">
                <span className="text-sm text-gray-300 tabular-nums w-6 shrink-0">
                  {index + 1}
                </span>
                <span className="flex-1 text-gray-900">
                  {item.title}
                  {item.snoozedUntil && (
                    <span className="ml-2 text-xs text-gray-400">sleeping until tomorrow</span>
                  )}
                </span>
                <button
                  type="button"
                  disabled={drop.isPending}
                  onClick={() => drop.mutate(item.id)}
                  className="text-sm text-gray-400 hover:text-gray-700 disabled:opacity-40 shrink-0"
                  aria-label={`Let go of ${item.title}`}
                >
                  let go
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
};
