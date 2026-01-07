import api from './api';

export interface JournalEntry {
  id: string;
  userId: string;
  title?: string;
  content: string;
  mood?: 'grateful' | 'reflective' | 'motivated' | 'challenged' | 'proud' | 'neutral';
  tags: string[];
  milestoneId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface JournalEntryRequest {
  title?: string;
  content: string;
  mood?: 'grateful' | 'reflective' | 'motivated' | 'challenged' | 'proud' | 'neutral';
  tags?: string[];
  milestoneId?: string;
}

export const journalService = {
  async createEntry(data: JournalEntryRequest): Promise<JournalEntry> {
    const response = await api.post<JournalEntry>('/journal', data);
    return response.data;
  },

  async getEntries(params?: {
    limit?: number;
    offset?: number;
    mood?: string;
    milestoneId?: string;
  }): Promise<{ entries: JournalEntry[]; total: number; limit: number; offset: number }> {
    const response = await api.get('/journal', { params });
    return response.data;
  },

  async getEntry(id: string): Promise<JournalEntry> {
    const response = await api.get<JournalEntry>(`/journal/${id}`);
    return response.data;
  },

  async updateEntry(id: string, data: Partial<JournalEntryRequest>): Promise<JournalEntry> {
    const response = await api.put<JournalEntry>(`/journal/${id}`, data);
    return response.data;
  },

  async deleteEntry(id: string): Promise<void> {
    await api.delete(`/journal/${id}`);
  },
};
