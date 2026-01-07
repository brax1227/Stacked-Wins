export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  stressLevel: number;
  anxietyLevel: number;
  moodStability: number;
  sleepQuality: number;
  sleepHours: number;
  weekdayMinutes: number;
  weekendMinutes: number;
  goals: string[];
  values: string[];
  currentStruggles: string[];
  preferredTone: 'steady' | 'firm' | 'gentle';
}

export interface GrowthPlan {
  id: string;
  userId: string;
  vision: string;
  intensity: 'low' | 'standard' | 'high';
  isActive: boolean;
  milestones: Milestone[];
  tasks: Task[];
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  planId: string;
  title: string;
  description: string;
  targetDate: string;
  progress: number;
  completedAt: string | null;
}

export interface Task {
  id: string;
  planId: string;
  title: string;
  description?: string;
  estimatedMinutes: number;
  isAnchorWin: boolean;
  category: 'mental' | 'physical' | 'purpose' | 'routine';
  order: number;
  completed?: boolean; // Client-side completion status
}

export interface DailyCheckIn {
  id: string;
  userId: string;
  date: string;
  energy: number;
  stress: number;
  sleepQuality?: number;
  reflection?: string;
  createdAt: string;
}

export interface ProgressMetrics {
  winsStacked: number;
  consistencyRate: number;
  baselineStreak: number;
  recoveryStrength: number;
  lastUpdated: string;
}
