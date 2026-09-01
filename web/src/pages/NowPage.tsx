import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { stackService } from '../services/stackService';

/**
 * The one-card screen. This is the product.
 *
 * The user's problem is that holding the whole pile in their head is what
 * freezes them, and a full list on screen recreates that exact overwhelm.
 * So this screen shows exactly one thing and nothing else -- deliberately no
 * remaining count, no list, no badges. Choosing is thinking, and thinking is
 * the thing that breaks them. See PROBLEM.md.
 */
export const NowPage = () => {
  const queryClient = useQueryClient();
  const [breakingDown, setBreakingDown] = useState(false);
  const [pieces, setPieces] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['stackNext'],
    queryFn: () => stackService.getNext(),
  });

  const nextCard = () => {
    setBreakingDown(false);
    setPieces('');
    queryClient.invalidateQueries({ queryKey: ['stackNext'] });
    queryClient.invalidateQueries({ queryKey: ['stack'] });
  };

  const move = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'done' | 'push' | 'later' }) =>
      stackService[action](id),
    onSuccess: nextCard,
  });

  const split = useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => stackService.split(id, text),
    onSuccess: nextCard,
  });

  const item = data?.item ?? null;
  const busy = move.isPending || split.isPending;

  if (isLoading) {
    return (
      <Centered>
        <p className="text-gray-400">One second…</p>
      </Centered>
    );
  }

  // Nothing left to deal. Calm, finished, no pressure to add more.
  if (!item) {
    return (
      <Centered>
        <p className="text-3xl sm:text-4xl font-semibold text-gray-900">That's everything.</p>
        <p className="mt-4 text-gray-500">
          {data?.sleeping
            ? `Nothing else for today. ${data.sleeping} ${
                data.sleeping === 1 ? 'card is' : 'cards are'
              } waiting for tomorrow.`
            : 'Your stack is clear.'}
        </p>
        {Boolean(data?.done) && (
          <p className="mt-2 text-sm text-gray-400">
            {data?.done} cleared so far. That's the stack.
          </p>
        )}
        <Link
          to="/dump"
          className="mt-10 inline-block bg-primary-700 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-primary-800 transition-colors"
        >
          Add something
        </Link>
      </Centered>
    );
  }

  // "Too big" -- the reason the pile froze them. Break it into pieces and the
  // first piece becomes the next card.
  if (breakingDown) {
    return (
      <Centered>
        <p className="text-sm uppercase tracking-widest text-gray-400">Break it up</p>
        <p className="mt-4 text-xl sm:text-2xl text-gray-500">{item.title}</p>
        <p className="mt-8 text-gray-600">
          What's the smallest first piece? One per line.
        </p>
        <textarea
          autoFocus
          rows={5}
          value={pieces}
          onChange={(event) => setPieces(event.target.value)}
          placeholder={'find the phone number\nwrite down what to ask\nmake the call'}
          className="mt-4 w-full max-w-xl rounded-xl border-2 border-gray-200 p-4 text-lg focus:outline-none focus:border-primary-500"
        />
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            disabled={busy || pieces.trim().length === 0}
            onClick={() => split.mutate({ id: item.id, text: pieces })}
            className="bg-primary-700 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-primary-800 disabled:opacity-40 transition-colors"
          >
            Break it up
          </button>
          <button
            type="button"
            onClick={() => setBreakingDown(false)}
            className="px-6 py-4 rounded-xl text-gray-500 hover:text-gray-700"
          >
            Never mind
          </button>
        </div>
      </Centered>
    );
  }

  return (
    <Centered>
      {/* The card. Big enough to read from arm's length, like a sticky note
          on a door -- not a row in a table. */}
      <p className="text-sm uppercase tracking-widest text-gray-400">Right now</p>
      <h1 className="mt-6 text-3xl sm:text-5xl font-semibold text-gray-900 leading-tight">
        {item.title}
      </h1>

      {data?.suggestSplit && (
        <p className="mt-6 text-sm text-gray-500">
          This one keeps coming back around. It might be bigger than one thing.
        </p>
      )}

      <div className="mt-12 w-full max-w-md">
        <button
          type="button"
          disabled={busy}
          onClick={() => move.mutate({ id: item.id, action: 'done' })}
          className="w-full bg-primary-700 text-white py-5 rounded-xl text-xl font-medium hover:bg-primary-800 disabled:opacity-40 transition-colors"
        >
          Done
        </button>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <SecondaryMove
            disabled={busy}
            onClick={() => move.mutate({ id: item.id, action: 'push' })}
            label="Not now"
          />
          <SecondaryMove
            disabled={busy}
            onClick={() => move.mutate({ id: item.id, action: 'later' })}
            label="Not today"
          />
          <SecondaryMove
            disabled={busy}
            onClick={() => setBreakingDown(true)}
            label="Too big"
          />
        </div>
      </div>

      {/* The full list is the user's data, so it's always reachable -- but it
          is never the default view and carries no count here. */}
      <Link to="/stack" className="mt-12 text-sm text-gray-400 hover:text-gray-600">
        see everything
      </Link>
    </Centered>
  );
};

const Centered = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-[calc(100vh-4rem)] flex flex-col items-center justify-center text-center px-6 py-16">
    {children}
  </div>
);

const SecondaryMove = ({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled: boolean;
}) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className="py-4 rounded-xl border-2 border-gray-200 text-gray-600 font-medium hover:border-gray-300 hover:text-gray-900 disabled:opacity-40 transition-colors"
  >
    {label}
  </button>
);
