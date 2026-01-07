// Shared TypeScript types for backend and web

export interface User {
  id: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface Assessment {
  id: string;
  userId: string;
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
  completedAt: string;
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
  progress: number; // 0-100
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
}

export interface DailyCheckIn {
  id: string;
  userId: string;
  date: string;
  energy: number; // 1-10
  stress: number; // 1-10
  sleepQuality?: number; // 1-10
  reflection?: string;
  createdAt: string;
}

export interface ProgressMetrics {
  userId: string;
  winsStacked: number;
  consistencyRate: number; // 0-100
  baselineStreak: number;
  recoveryStrength: number;
  lastUpdated: string;
}

export interface CoachChat {
  id: string;
  userId: string;
  message: string;
  response: string;
  role: 'user' | 'assistant';
  createdAt: string;
}
