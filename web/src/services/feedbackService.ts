import api from './api';

export interface Feedback {
  id: string;
  userId: string;
  type: 'bug' | 'feature' | 'improvement' | 'general';
  title?: string;
  message: string;
  rating?: number;
  status: 'new' | 'reviewed' | 'in_progress' | 'resolved';
  createdAt: string;
  updatedAt: string;
}

export interface FeedbackRequest {
  type: 'bug' | 'feature' | 'improvement' | 'general';
  title?: string;
  message: string;
  rating?: number;
}

export const feedbackService = {
  async submitFeedback(data: FeedbackRequest): Promise<Feedback> {
    const response = await api.post<Feedback>('/feedback', data);
    return response.data;
  },

  async getMyFeedback(limit?: number): Promise<Feedback[]> {
    const response = await api.get<Feedback[]>('/feedback', {
      params: limit ? { limit } : undefined,
    });
    return response.data;
  },
};
