// ---------- Types (re-exported from shared) ----------

export type {
  Behavior,
  Direction,
  MessageStatus,
  PhoneNumber,
  Message,
  PaginatedMessages,
  SendResult,
  Stats,
  CreateNumberInput,
  UpdateNumberInput,
} from '../../shared/types.js';

import type {
  Direction,
  MessageStatus,
  PhoneNumber,
  Message,
  PaginatedMessages,
  SendResult,
  Stats,
  CreateNumberInput,
  UpdateNumberInput,
} from '../../shared/types.js';

// ---------- Fetch wrapper ----------

const BASE = '/api/v1';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });

  // 204 No Content
  if (res.status === 204) return undefined as T;

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error ?? `Request failed: ${res.status}`);
  }

  return data as T;
}

// ---------- API methods ----------

export const api = {
  // Phone numbers
  getNumbers: () => request<PhoneNumber[]>('/numbers'),

  createNumber: (input: CreateNumberInput) =>
    request<PhoneNumber>('/numbers', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  generateNumber: (countryCode = 'US') =>
    request<PhoneNumber>('/numbers/generate', {
      method: 'POST',
      body: JSON.stringify({ country_code: countryCode }),
    }),

  updateNumber: (id: string, input: UpdateNumberInput) =>
    request<PhoneNumber>(`/numbers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),

  deleteNumber: (id: string) =>
    request<void>(`/numbers/${id}`, { method: 'DELETE' }),

  // Messages
  getMessages: (params?: {
    phone_id?: string;
    catch_all?: boolean;
    q?: string;
    direction?: Direction;
    status?: MessageStatus;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.phone_id) qs.set('phone_id', params.phone_id);
    if (params?.catch_all) qs.set('catch_all', 'true');
    if (params?.q) qs.set('q', params.q);
    if (params?.direction) qs.set('direction', params.direction);
    if (params?.status) qs.set('status', params.status);
    if (params?.limit !== undefined) qs.set('limit', String(params.limit));
    if (params?.offset !== undefined) qs.set('offset', String(params.offset));

    const query = qs.toString();
    return request<PaginatedMessages>(`/messages${query ? `?${query}` : ''}`);
  },

  getMessage: (id: string) => request<Message>(`/messages/${id}`),

  clearMessages: (phoneId?: string) => {
    const qs = phoneId ? `?phone_id=${phoneId}` : '';
    return request<void>(`/messages${qs}`, { method: 'DELETE' });
  },

  // Send (app -> phone)
  send: (input: {
    to: string;
    body: string;
    from?: string;
    template_key?: string;
    metadata?: Record<string, unknown>;
  }) =>
    request<SendResult>('/send', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Reply (phone -> app)
  sendReply: (input: { from: string; body: string; webhook_url?: string }) =>
    request<{ success: boolean; message_id: string; webhook_status: string | null }>('/reply', {
      method: 'POST',
      body: JSON.stringify(input),
    }),

  // Stats
  getStats: () => request<Stats>('/stats'),

  // Reset
  reset: () => request<{ success: boolean }>('/reset', { method: 'POST' }),

  // Health
  health: () => request<{ status: string }>('/health'),
};
