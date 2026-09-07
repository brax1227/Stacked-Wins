import api from './api';

/**
 * The stack: everything the user is carrying, dealt back one card at a time.
 * See PROBLEM.md for why the app works this way.
 */

export type StackItemStatus = 'open' | 'done' | 'dropped' | 'split';

/**
 * The two lanes: things you have to do, and things you want to do.
 * Picked once per dump session, never a gate on getting a card.
 */
export type StackKind = 'need' | 'want';

export type RankMove = 'up' | 'down' | 'top';

export const LANES: { kind: StackKind; label: string; blurb: string }[] = [
  { kind: 'need', label: 'Need to', blurb: 'The stuff that has to get done.' },
  { kind: 'want', label: 'Want to', blurb: "The stuff you'd actually like to do." },
];

export interface StackItem {
  id: string;
  title: string;
  kind: StackKind;
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
  /** Cards that can be dealt right now, in the requested lane. */
  remaining: number;
  /** Cards sleeping off a "Not today". */
  sleeping: number;
  /** Cards cleared, all time. */
  done: number;
  /**
   * Askable cards per lane. Lets an empty lane point at the other one without
   * ever putting a number on the card screen.
   */
  lanes: Record<StackKind, number>;
}

export interface NextCard extends StackCounts {
  /** Exactly one card, or null when the lane is clear. Never a list. */
  item: StackItem | null;
  /** The lane this card came from. */
  kind: StackKind;
  /** The card keeps getting pushed -- offer to break it down. */
  suggestSplit: boolean;
}

export interface StackCapabilities {
  /** Whether this deployment has an Anthropic key configured. */
  splitAssist: boolean;
}

export const stackService = {
  /** What this deployment can do, so the UI can hide what isn't available. */
  async getCapabilities(): Promise<StackCapabilities> {
    const response = await api.get<StackCapabilities>('/stack/capabilities');
    return response.data;
  },

  /** Job 1: get it out of the head. One thing per line, into one lane. */
  async dump(text: string, kind: StackKind = 'need'): Promise<StackCounts & { added: number }> {
    const response = await api.post('/stack/dump', { text, kind });
    return response.data;
  },

  async addOne(title: string, kind: StackKind = 'need'): Promise<StackItem> {
    const response = await api.post<StackItem>('/stack', { title, kind });
    return response.data;
  },

  /** Job 2: the whole product. One card, from one lane. */
  async getNext(kind: StackKind = 'need'): Promise<NextCard> {
    const response = await api.get<NextCard>('/stack/next', { params: { kind } });
    return response.data;
  },

  /** The full list. Always available, never the default view. */
  async getStack(
    kind: StackKind | 'all' = 'need',
    status: StackItemStatus | 'all' = 'open'
  ): Promise<StackCounts & { items: StackItem[] }> {
    const response = await api.get('/stack', { params: { kind, status } });
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

  /**
   * Ask Claude for the smallest first steps of a card. Suggests only —
   * nothing is written until the user confirms through `split`.
   */
  async suggestSplit(id: string): Promise<{ pieces: string[] }> {
    const response = await api.post<{ pieces: string[] }>(`/stack/${id}/split/suggest`);
    return response.data;
  },

  /** Move a card between the two lanes. */
  async setKind(id: string, kind: StackKind): Promise<StackItem> {
    const response = await api.post<StackItem>(`/stack/${id}/kind`, { kind });
    return response.data;
  },

  /** Order a card against its lane-mates. Always optional. */
  async rank(id: string, move: RankMove): Promise<StackItem> {
    const response = await api.post<StackItem>(`/stack/${id}/rank`, { move });
    return response.data;
  },

  async drop(id: string): Promise<StackItem> {
    const response = await api.post<StackItem>(`/stack/${id}/drop`);
    return response.data;
  },
};
