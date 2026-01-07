import api from './api';

export interface CoachMessage {
  id: string;
  message: string;
  response: string;
  role: 'user' | 'assistant';
  createdAt: string;
}

export const coachService = {
  async sendMessage(message: string): Promise<CoachMessage> {
    const response = await api.post<CoachMessage>('/coach/chat', { message });
    return response.data;
  },

  async getHistory(): Promise<CoachMessage[]> {
    const response = await api.get<CoachMessage[]>('/coach/history');
    return response.data;
  },
};
