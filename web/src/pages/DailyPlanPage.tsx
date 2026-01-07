import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { planService } from '../services/planService';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { ProgressRing } from '../components/ProgressRing';
import { Slider } from '../components/Slider';
import type { Task } from '../types';
import { format } from 'date-fns';

export const DailyPlanPage = () => {
  const navigate = useNavigate();
  const [energy, setEnergy] = useState(5);
  const [stress, setStress] = useState(5);
  const [showCheckIn, setShowCheckIn] = useState(true);
  const queryClient = useQueryClient();

  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['todayTasks'],
    queryFn: () => planService.getTodayTasks(),
    retry: 1,
  });
  
  // Initialize completed tasks when tasks load
  useEffect(() => {
    const completed = tasks.filter((t) => t.completed).map((t) => t.id);
    if (completed.length > 0) {
      setCompletedTasks(new Set(completed));
    }
  }, [tasks]);

  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => planService.completeTask(taskId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayTasks'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const adjustPlanMutation = useMutation({
    mutationFn: (mode: 'minimum' | 'standard') => planService.adjustToday({ mode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['todayTasks'] });
    },
  });

  const submitCheckInMutation = useMutation({
    mutationFn: () =>
      planService.submitCheckIn({
        energy,
        stress,
      }),
    onSuccess: () => {
      setShowCheckIn(false);
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });

  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());
  
  const completedCount = completedTasks.size;
  const totalCount = tasks.length;
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const totalTime = tasks.reduce((sum, task) => sum + task.estimatedMinutes, 0);

  const handleCompleteTask = (taskId: string) => {
    setCompletedTasks((prev) => new Set([...prev, taskId]));
    completeTaskMutation.mutate(taskId);
  };
  
  // Initialize completed tasks from API response
  const taskCompleted = (taskId: string) => completedTasks.has(taskId);

  const anchorWin = tasks.find((t) => t.isAnchorWin);
  const regularTasks = tasks.filter((t) => !t.isAnchorWin);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading your plan...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading tasks</p>
            <p className="text-sm text-gray-600 mb-4">
              {(error as any)?.response?.data?.error || 'Please try again later'}
            </p>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </div>
        </Card>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <p className="text-gray-900 font-semibold mb-2">No tasks for today</p>
            <p className="text-sm text-gray-600 mb-4">
              Complete your assessment and generate a plan to get started
            </p>
            <Button onClick={() => navigate('/onboarding')}>Go to Onboarding</Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {format(new Date(), 'EEEE, MMMM d')}
          </h1>
          <p className="text-gray-600">Small wins build strong foundations</p>
        </div>

        {/* Quick Check-in */}
        {showCheckIn && (
          <Card>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-gray-900">Quick Check-in</h2>
                <button
                  onClick={() => setShowCheckIn(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
              <Slider
                label="Energy Level"
                value={energy}
                onChange={setEnergy}
                min={1}
                max={10}
              />
              <Slider
                label="Stress Level"
                value={stress}
                onChange={setStress}
                min={1}
                max={10}
              />
              <Button
                onClick={() => submitCheckInMutation.mutate()}
                disabled={submitCheckInMutation.isPending}
                className="w-full"
              >
                {submitCheckInMutation.isPending ? 'Saving...' : 'Save Check-in'}
              </Button>
            </div>
          </Card>
        )}

        {/* Progress Ring */}
        <div className="flex justify-center">
          <div className="relative">
            <ProgressRing progress={progress} size={140} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <div className="text-3xl font-bold text-gray-900">{completedCount}</div>
              <div className="text-sm text-gray-600">of {totalCount} wins</div>
            </div>
          </div>
        </div>

        {/* Time Estimate */}
        <div className="text-center">
          <p className="text-sm text-gray-600">
            Estimated time: <span className="font-semibold text-gray-900">{totalTime} minutes</span>
          </p>
        </div>

        {/* Tasks */}
        <div className="space-y-4">
          {/* Anchor Win */}
          {anchorWin && (
            <Card className="border-2 border-primary-700">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-semibold text-primary-700 bg-primary-100 px-2 py-1 rounded">
                      ANCHOR WIN
                    </span>
                    {taskCompleted(anchorWin.id) && (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
                        ✓ COMPLETE
                      </span>
                    )}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-1">{anchorWin.title}</h3>
                  {anchorWin.description && (
                    <p className="text-sm text-gray-600 mb-2">{anchorWin.description}</p>
                  )}
                  <p className="text-xs text-gray-500">{anchorWin.estimatedMinutes} minutes</p>
                </div>
                {!taskCompleted(anchorWin.id) && (
                  <Button
                    size="sm"
                    onClick={() => handleCompleteTask(anchorWin.id)}
                    disabled={completeTaskMutation.isPending}
                  >
                    Complete
                  </Button>
                )}
              </div>
            </Card>
          )}

          {/* Regular Tasks */}
          {regularTasks.map((task) => (
            <Card key={task.id} className={taskCompleted(task.id) ? 'opacity-60' : ''}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-gray-600 capitalize">
                      {task.category}
                    </span>
                    {taskCompleted(task.id) && (
                      <span className="text-xs font-semibold text-green-700 bg-green-100 px-2 py-1 rounded">
                        ✓ COMPLETE
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-gray-900 mb-1">{task.title}</h3>
                  {task.description && (
                    <p className="text-sm text-gray-600 mb-2">{task.description}</p>
                  )}
                  <p className="text-xs text-gray-500">{task.estimatedMinutes} minutes</p>
                </div>
                {!taskCompleted(task.id) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCompleteTask(task.id)}
                    disabled={completeTaskMutation.isPending}
                  >
                    Complete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => adjustPlanMutation.mutate('minimum')}
            disabled={adjustPlanMutation.isPending}
            className="flex-1"
          >
            Minimum Day
          </Button>
          <Button
            variant="outline"
            onClick={() => adjustPlanMutation.mutate('standard')}
            disabled={adjustPlanMutation.isPending}
            className="flex-1"
          >
            Standard Day
          </Button>
        </div>

        {/* Motivational Message */}
        {completedCount > 0 && (
          <Card className="bg-primary-50 border-primary-200">
            <p className="text-center text-primary-900 font-medium">
              You kept your word today. That counts.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};
