// ---------- Shared Types ----------
// Single source of truth for types used by both server and client.

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
