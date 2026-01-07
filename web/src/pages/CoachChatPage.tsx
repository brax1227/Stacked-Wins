import { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { coachService } from '../services/coachService';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import type { CoachMessage } from '../services/coachService';
import { format } from 'date-fns';

const QUICK_ACTIONS = [
  { label: 'Adjust today', value: 'I need to adjust my plan for today' },
  { label: 'I missed days', value: 'I missed some days and need help getting back on track' },
  { label: 'I feel anxious', value: 'I\'m feeling anxious and need support' },
  { label: 'Make this harder', value: 'I want to increase the difficulty' },
  { label: 'Make this easier', value: 'I need to reduce the difficulty' },
  { label: 'Explain my plan', value: 'Can you explain why my plan is structured this way?' },
];

export const CoachChatPage = () => {
  const [message, setMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data: history = [] } = useQuery({
    queryKey: ['coachHistory'],
    queryFn: () => coachService.getHistory(),
  });

  const sendMessageMutation = useMutation({
    mutationFn: (msg: string) => coachService.sendMessage(msg),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['coachHistory'] });
      setMessage('');
    },
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [history, sendMessageMutation.isPending]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !sendMessageMutation.isPending) {
      sendMessageMutation.mutate(message);
    }
  };

  const handleQuickAction = (value: string) => {
    sendMessageMutation.mutate(value);
  };

  const allMessages: CoachMessage[] = [
    ...history,
    ...(sendMessageMutation.isPending
      ? [
          {
            id: 'pending',
            message: message,
            response: '',
            role: 'user' as const,
            createdAt: new Date().toISOString(),
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">AI Coach</h1>
          <p className="text-gray-600">Your steady guide for growth</p>
        </div>

        {/* Quick Actions */}
        <div className="mb-4 flex flex-wrap gap-2">
          {QUICK_ACTIONS.map((action) => (
            <button
              key={action.label}
              onClick={() => handleQuickAction(action.value)}
              disabled={sendMessageMutation.isPending}
              className="px-4 py-2 text-sm bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto space-y-4 mb-6">
          {allMessages.length === 0 && (
            <Card className="text-center py-12">
              <p className="text-gray-600 mb-4">
                Start a conversation with your AI coach. Ask questions, get support, or adjust your
                plan.
              </p>
              <p className="text-sm text-gray-500">
                Your coach is here to help you stay on track and build discipline.
              </p>
            </Card>
          )}

          {allMessages.map((msg) => (
            <div key={msg.id} className="space-y-2">
              {msg.role === 'user' && (
                <div className="flex justify-end">
                  <Card className="max-w-[80%] bg-primary-700 text-white">
                    <p>{msg.message}</p>
                  </Card>
                </div>
              )}
              {msg.role === 'assistant' && msg.response && (
                <div className="flex justify-start">
                  <Card className="max-w-[80%]">
                    <p className="text-gray-900 whitespace-pre-wrap">{msg.response}</p>
                    <p className="text-xs text-gray-500 mt-2">
                      {format(new Date(msg.createdAt), 'h:mm a')}
                    </p>
                  </Card>
                </div>
              )}
            </div>
          ))}

          {sendMessageMutation.isPending && (
            <div className="flex justify-start">
              <Card className="max-w-[80%]">
                <div className="flex items-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-700"></div>
                  <p className="text-gray-600">Coach is thinking...</p>
                </div>
              </Card>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Ask your coach..."
            disabled={sendMessageMutation.isPending}
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:opacity-50"
          />
          <Button type="submit" disabled={!message.trim() || sendMessageMutation.isPending}>
            Send
          </Button>
        </form>
      </div>
    </div>
  );
};
