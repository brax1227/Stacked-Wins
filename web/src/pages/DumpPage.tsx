import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { stackService } from '../services/stackService';

/**
 * The brain dump. Job 1: get it out of the head.
 *
 * One box, one thing per line, no categories, no due dates, no priorities,
 * no estimates. Structure is a tax charged at the exact moment the user has
 * the least to give. The only things that matter here are speed and
 * completeness. See PROBLEM.md.
 */
export const DumpPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');

  const dump = useMutation({
    mutationFn: (value: string) => stackService.dump(value),
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
        Everything you're carrying, one per line. Don't sort it, don't rank it,
        don't finish the thought. You'll only ever see one of these at a time.
      </p>

      <textarea
        autoFocus
        rows={14}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder={'call the bank\nlaundry\nemail my advisor back\noil change\nthat thing I keep forgetting'}
        className="mt-8 w-full rounded-xl border-2 border-gray-200 p-5 text-lg leading-relaxed focus:outline-none focus:border-primary-500"
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
