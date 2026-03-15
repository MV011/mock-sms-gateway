import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/server/db/connection.js';
import {
  createPhoneNumber,
  createMessage,
  getMessageById,
  getMessages,
  clearMessages,
  type CreateMessageInput,
} from '../src/server/db/queries.js';
import Database from 'better-sqlite3';

describe('Message queries', () => {
  let db: Database.Database;
  let phoneId: string;

  beforeEach(() => {
    db = createDatabase(':memory:');
    // Create a test phone number
    const phone = createPhoneNumber(db, {
      number: '+40712345678',
      label: 'Test Patient',
      behavior: 'deliver',
    });
    phoneId = phone.id;
  });

  it('creates a linked message', () => {
    const msg = createMessage(db, {
      phone_number: '+40712345678',
      direction: 'outbound',
      body: 'Hello patient',
      status: 'delivered',
    });

    expect(msg.id).toBeDefined();
    expect(msg.phone_id).toBe(phoneId);
    expect(msg.phone_number).toBe('+40712345678');
    expect(msg.direction).toBe('outbound');
    expect(msg.body).toBe('Hello patient');
    expect(msg.status).toBe('delivered');
    expect(msg.created_at).toBeDefined();
  });

  it('creates a catch-all message (unknown number)', () => {
    const msg = createMessage(db, {
      phone_number: '+40799999999',
      direction: 'outbound',
      body: 'Unknown recipient',
      status: 'delivered',
    });

    expect(msg.phone_id).toBeNull();
    expect(msg.phone_number).toBe('+40799999999');
  });

  it('lists messages by phone_id', () => {
    createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: 'Msg 1', status: 'delivered' });
    createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: 'Msg 2', status: 'delivered' });
    createMessage(db, { phone_number: '+40799999999', direction: 'outbound', body: 'Other', status: 'delivered' });

    const result = getMessages(db, { phone_id: phoneId });
    expect(result.data).toHaveLength(2);
    expect(result.total).toBe(2);
  });

  it('paginates messages', () => {
    for (let i = 0; i < 10; i++) {
      createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: `Msg ${i}`, status: 'delivered' });
    }

    const page1 = getMessages(db, { phone_id: phoneId, limit: 3, offset: 0 });
    expect(page1.data).toHaveLength(3);
    expect(page1.total).toBe(10);
    expect(page1.limit).toBe(3);
    expect(page1.offset).toBe(0);

    const page2 = getMessages(db, { phone_id: phoneId, limit: 3, offset: 3 });
    expect(page2.data).toHaveLength(3);
    expect(page2.offset).toBe(3);
  });

  it('searches messages by body text', () => {
    createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: 'Rezultatele sunt gata', status: 'delivered' });
    createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: 'Buna ziua', status: 'delivered' });

    const result = getMessages(db, { q: 'rezultat' });
    expect(result.data).toHaveLength(1);
    expect(result.data[0].body).toContain('Rezultatele');
  });

  it('lists catch-all messages', () => {
    createMessage(db, { phone_number: '+40799999999', direction: 'outbound', body: 'Catch all 1', status: 'delivered' });
    createMessage(db, { phone_number: '+40788888888', direction: 'outbound', body: 'Catch all 2', status: 'delivered' });
    createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: 'Known number', status: 'delivered' });

    const result = getMessages(db, { catch_all: true });
    expect(result.data).toHaveLength(2);
    expect(result.data.every(m => m.phone_id === null)).toBe(true);
  });

  it('clears messages by phone_id', () => {
    createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: 'To clear', status: 'delivered' });
    createMessage(db, { phone_number: '+40799999999', direction: 'outbound', body: 'Keep this', status: 'delivered' });

    clearMessages(db, phoneId);

    const cleared = getMessages(db, { phone_id: phoneId });
    expect(cleared.data).toHaveLength(0);

    const kept = getMessages(db, { catch_all: true });
    expect(kept.data).toHaveLength(1);
  });

  it('clears all messages', () => {
    createMessage(db, { phone_number: '+40712345678', direction: 'outbound', body: 'Msg 1', status: 'delivered' });
    createMessage(db, { phone_number: '+40799999999', direction: 'outbound', body: 'Msg 2', status: 'delivered' });

    clearMessages(db);

    const result = getMessages(db, {});
    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
  });
});
