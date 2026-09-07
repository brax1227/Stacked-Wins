import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stackService, LANES } from '../services/stackService';
import type { StackKind } from '../services/stackService';

/**
 * The brain dump. Job 1: get it out of the head.
 *
 * One box, one thing per line, no due dates, no priorities, no estimates.
 * Structure is a tax charged at the exact moment the user has the least to
 * give. The only things that matter here are speed and completeness.
 *
 * The lane toggle is the single exception, and it's cheap on purpose: one
 * choice for the whole dump rather than one per item, and it defaults, so it
 * can be ignored entirely. See PROBLEM.md.
 */
export const DumpPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [kind, setKind] = useState<StackKind>('need');

  const dump = useMutation({
    mutationFn: (value: string) => stackService.dump(value, kind),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stackNext'] });
      queryClient.invalidateQueries({ queryKey: ['stack'] });
      navigate('/now');
    },
  });

  const lineCount = text.split('\n').filter((line) => line.trim().length > 0).length;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <h1 className="text-3xl font-semibold text-gray-900">
        Put it all down here.
      </h1>
      <p className="mt-3 text-gray-600">
        Everything you're carrying, one per line. Don't rank it, don't finish
        the thought. You'll only ever see one of these at a time.
      </p>

      {/* One choice for the whole dump, not one per line. Dump your needs,
          flip the switch, dump your wants. */}
      <div className="mt-8 flex gap-1 p-1 bg-gray-100 rounded-xl w-fit">
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
          </button>
        ))}
      </div>
      <p className="mt-2 text-sm text-gray-400">
        {LANES.find((lane) => lane.kind === kind)?.blurb}
      </p>

      <textarea
        autoFocus
        rows={12}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={'call the bank\nlaundry\nemail my advisor back\noil change\nthat thing I keep forgetting'}
        className="mt-5 w-full rounded-xl border-2 border-gray-200 p-5 text-lg leading-relaxed focus:outline-none focus:border-primary-500"
      />

      <div className="mt-6 flex items-center justify-between gap-4">
        <p className="text-sm text-gray-400">
          {lineCount === 0
            ? 'One thing per line.'
            : `${lineCount} ${lineCount === 1 ? 'thing' : 'things'} — out of your head.`}
        </p>
        <button
          type="button"
          disabled={dump.isPending || lineCount === 0}
          onClick={() => dump.mutate(text)}
          className="bg-primary-700 text-white px-8 py-4 rounded-xl text-lg font-medium hover:bg-primary-800 disabled:opacity-40 transition-colors"
        >
          {dump.isPending ? 'Adding…' : 'Put it down'}
        </button>
      </div>

      {dump.isError && (
        <p className="mt-4 text-sm text-red-600">
          That didn't save. Your text is still here — try again.
        </p>
      )}
    </div>
  );
};
