import api from './api';

/**
 * The stack: everything the user is carrying, dealt back one card at a time.
 * See PROBLEM.md for why the app works this way.
 */

export type StackItemStatus = 'open' | 'done' | 'dropped' | 'split';

export interface StackItem {
  id: string;
  title: string;
  status: StackItemStatus;
  position: number;
  snoozedUntil?: string | null;
  pushCount: number;
  parentId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface StackCounts {
  /** Cards that can be dealt right now. */
  remaining: number;
  /** Cards sleeping off a "Not today". */
  sleeping: number;
  /** Cards cleared, all time. */
  done: number;
}

export interface NextCard extends StackCounts {
  /** Exactly one card, or null when the stack is clear. Never a list. */
  item: StackItem | null;
  /** The card keeps getting pushed -- offer to break it down. */
  suggestSplit: boolean;
}

export const stackService = {
  /** Job 1: get it out of the head. One thing per line. */
  async dump(text: string): Promise<StackCounts & { added: number }> {
    const response = await api.post('/stack/dump', { text });
    return response.data;
  },

  async addOne(title: string): Promise<StackItem> {
    const response = await api.post<StackItem>('/stack', { title });
    return response.data;
  },

  /** Job 2: the whole product. One card. */
  async getNext(): Promise<NextCard> {
    const response = await api.get<NextCard>('/stack/next');
    return response.data;
  },

  /** The full list. Always available, never the default view. */
  async getStack(status: StackItemStatus | 'all' = 'open'): Promise<StackCounts & { items: StackItem[] }> {
    const response = await api.get('/stack', { params: { status } });
    return response.data;
  },

  async done(id: string): Promise<StackItem> {
    const response = await api.post<StackItem>(`/stack/${id}/done`);
    return response.data;
  },

  /** "Not now" — straight to the back, no penalty. */
  async push(id: string): Promise<StackItem> {
    const response = await api.post<StackItem>(`/stack/${id}/push`);
    return response.data;
  },

  /** "Not today" — sleeps until tomorrow, keeps its place. */
  async later(id: string): Promise<StackItem> {
    const response = await api.post<StackItem>(`/stack/${id}/later`);
    return response.data;
  },

  /** "Too big" — break it down; the first piece is dealt next. */
  async split(id: string, pieces: string): Promise<{ pieces: number }> {
    const response = await api.post(`/stack/${id}/split`, { pieces });
    return response.data;
  },

  async drop(id: string): Promise<StackItem> {
    const response = await api.post<StackItem>(`/stack/${id}/drop`);
    return response.data;
  },
};
