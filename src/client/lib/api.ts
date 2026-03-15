// ---------- Types (mirror server-side models) ----------

export type Behavior = 'deliver' | 'fail' | 'delay' | 'reject' | 'rate_limit' | 'timeout';
export type Direction = 'outbound' | 'inbound';
export type MessageStatus = 'delivered' | 'failed' | 'pending' | 'rejected';

export interface PhoneNumber {
  id: string;
  number: string;
  label: string | null;
  country_code: string | null;
  behavior: Behavior;
  behavior_config: Record<string, unknown> | null;
  is_magic: boolean;
  pinned: boolean;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  phone_id: string | null;
  phone_number: string;
  direction: Direction;
  body: string;
  from_name: string | null;
  template_key: string | null;
  status: MessageStatus;
  error_message: string | null;
  metadata: Record<string, unknown> | null;
  webhook_status: string | null;
  created_at: string;
}

export interface PaginatedMessages {
  data: Message[];
  total: number;
  limit: number;
  offset: number;
}

export interface SendResult {
  success: boolean;
  message_id: string;
  status: MessageStatus;
  error?: string;
  to: string;
}

export interface Stats {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  rejected: number;
  outbound: number;
  inbound: number;
  catch_all: number;
}

export interface CreateNumberInput {
  number: string;
  label?: string;
  country_code?: string;
  behavior?: Behavior;
  behavior_config?: Record<string, unknown>;
  pinned?: boolean;
}

export interface UpdateNumberInput {
  label?: string;
  country_code?: string;
  behavior?: Behavior;
  behavior_config?: Record<string, unknown>;
  pinned?: boolean;
}

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
