import { useQuery } from '@tanstack/react-query';
import { planService } from '../services/planService';
import { Card } from '../components/Card';
import { ProgressRing } from '../components/ProgressRing';
import { format, subDays } from 'date-fns';

export const DashboardPage = () => {
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => planService.getDashboard(),
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-700 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <p className="text-red-600 mb-4">Error loading dashboard</p>
            <p className="text-sm text-gray-600">
              {(error as any)?.response?.data?.error || 'Please try again later'}
            </p>
          </div>
        </Card>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <div className="text-center">
            <p className="text-gray-600 mb-4">No data available</p>
            <p className="text-sm text-gray-500">Complete your assessment to see your progress</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Progress Dashboard</h1>
          <p className="text-gray-600">Your journey to self-mastery</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-700 mb-2">
                {dashboard.winsStacked}
              </div>
              <div className="text-sm text-gray-600">Wins Stacked</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-700 mb-2">
                {Math.round(dashboard.consistencyRate)}%
              </div>
              <div className="text-sm text-gray-600">Consistency Rate</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-700 mb-2">
                {dashboard.baselineStreak}
              </div>
              <div className="text-sm text-gray-600">Day Streak</div>
            </div>
          </Card>

          <Card>
            <div className="text-center">
              <div className="text-4xl font-bold text-primary-700 mb-2">
                {dashboard.recoveryStrength}
              </div>
              <div className="text-sm text-gray-600">Recovery Strength</div>
            </div>
          </Card>
        </div>

        {/* Consistency Progress */}
        <Card>
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Consistency</h2>
          <div className="flex items-center gap-6">
            <ProgressRing progress={dashboard.consistencyRate} size={100} />
            <div className="flex-1">
              <p className="text-gray-600 mb-2">
                You've completed at least one win on{' '}
                <span className="font-semibold text-gray-900">
                  {Math.round(dashboard.consistencyRate)}%
                </span>{' '}
                of days.
              </p>
              <p className="text-sm text-gray-500">
                Consistency beats intensity. Keep showing up.
              </p>
            </div>
          </div>
        </Card>

        {/* Mood Trend */}
        {dashboard.moodTrend && dashboard.moodTrend.length > 0 && (
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Mood Trend</h2>
            <div className="h-48 flex items-end gap-2">
              {dashboard.moodTrend.slice(-7).map((mood, index) => {
                const height = (mood / 10) * 100;
                return (
                  <div key={index} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full bg-primary-700 rounded-t transition-all"
                      style={{ height: `${height}%` }}
                    />
                    <div className="text-xs text-gray-500 mt-2">
                      {format(subDays(new Date(), 6 - index), 'EEE')}
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* Recent Check-ins */}
        {dashboard.recentCheckIns && dashboard.recentCheckIns.length > 0 && (
          <Card>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Check-ins</h2>
            <div className="space-y-3">
              {dashboard.recentCheckIns.slice(0, 5).map((checkIn) => (
                <div
                  key={checkIn.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium text-gray-900">
                      {format(new Date(checkIn.date), 'MMMM d, yyyy')}
                    </div>
                    <div className="text-sm text-gray-600">
                      Energy: {checkIn.energy}/10 • Stress: {checkIn.stress}/10
                    </div>
                  </div>
                  {checkIn.reflection && (
                    <div className="text-sm text-gray-600 italic">"{checkIn.reflection}"</div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Proof Panel */}
        <Card className="bg-primary-50 border-primary-200">
          <h2 className="text-xl font-semibold text-primary-900 mb-2">You Showed Up</h2>
          <p className="text-primary-800">
            You've completed {dashboard.winsStacked} wins. Each one builds on the last. This is how
            discipline is built.
          </p>
        </Card>
      </div>
    </div>
  );
};
