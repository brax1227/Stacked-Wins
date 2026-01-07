import api from './api';
import type { GrowthPlan, Assessment, Task, DailyCheckIn, ProgressMetrics } from '../types';

export const planService = {
  async submitAssessment(data: Assessment): Promise<Assessment> {
    const response = await api.post<Assessment>('/assessment', data);
    return response.data;
  },

  async generatePlan(): Promise<GrowthPlan> {
    const response = await api.post<GrowthPlan>('/plan/generate');
    return response.data;
  },

  async getCurrentPlan(): Promise<GrowthPlan> {
    const response = await api.get<GrowthPlan>('/plan/current');
    return response.data;
  },

  async getTodayTasks(): Promise<Task[]> {
    const response = await api.get<Task[]>('/tasks/today');
    return response.data;
  },

  async completeTask(taskId: string): Promise<void> {
    await api.post(`/tasks/complete`, { taskId });
  },

  async adjustToday(adjustments: { mode?: 'minimum' | 'standard' }): Promise<Task[]> {
    const response = await api.put<Task[]>('/tasks/adjust', adjustments);
    return response.data;
  },

  async submitCheckIn(data: {
    energy: number;
    stress: number;
    sleepQuality?: number;
    reflection?: string;
  }): Promise<DailyCheckIn> {
    const response = await api.post<DailyCheckIn>('/checkin', data);
    return response.data;
  },

  async getDashboard(): Promise<ProgressMetrics & {
    recentCheckIns: DailyCheckIn[];
    moodTrend: number[];
  }> {
    const response = await api.get('/progress/dashboard');
    return response.data;
  },
};
