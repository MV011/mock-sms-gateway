import { describe, it, expect, beforeEach } from 'vitest';
import { createDatabase } from '../src/server/db/connection.js';
import {
  createPhoneNumber,
  getPhoneNumbers,
  getPhoneNumberById,
  getPhoneNumberByNumber,
  updatePhoneNumber,
  deletePhoneNumber,
  type PhoneNumber,
  type CreatePhoneNumberInput,
} from '../src/server/db/queries.js';
import Database from 'better-sqlite3';

describe('Phone number CRUD', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createDatabase(':memory:');
  });

  it('creates a phone number', () => {
    const input: CreatePhoneNumberInput = {
      number: '+40712345678',
      label: 'Test Patient',
      country_code: 'RO',
      behavior: 'deliver',
    };
    const phone = createPhoneNumber(db, input);

    expect(phone.id).toBeDefined();
    expect(phone.number).toBe('+40712345678');
    expect(phone.label).toBe('Test Patient');
    expect(phone.country_code).toBe('RO');
    expect(phone.behavior).toBe('deliver');
    expect(phone.is_magic).toBe(false);
    expect(phone.pinned).toBe(false);
    expect(phone.created_at).toBeDefined();
    expect(phone.updated_at).toBeDefined();
  });

  it('lists with pinned first', () => {
    createPhoneNumber(db, { number: '+40711111111', label: 'Unpinned', behavior: 'deliver' });
    createPhoneNumber(db, { number: '+40722222222', label: 'Pinned', behavior: 'deliver', pinned: true });

    const numbers = getPhoneNumbers(db);
    // Magic numbers (6, all pinned) + Pinned + Unpinned
    const labels = numbers.map(n => n.label);
    const pinnedIdx = labels.indexOf('Pinned');
    const unpinnedIdx = labels.indexOf('Unpinned');
    expect(pinnedIdx).toBeLessThan(unpinnedIdx);
  });

  it('finds by E.164 number', () => {
    createPhoneNumber(db, { number: '+40733333333', label: 'Find Me', behavior: 'deliver' });
    const phone = getPhoneNumberByNumber(db, '+40733333333');
    expect(phone).toBeDefined();
    expect(phone!.label).toBe('Find Me');
  });

  it('updates label and behavior', () => {
    const phone = createPhoneNumber(db, { number: '+40744444444', label: 'Original', behavior: 'deliver' });
    const updated = updatePhoneNumber(db, phone.id, {
      label: 'Updated',
      behavior: 'fail',
      behavior_config: { error_message: 'Custom error' },
    });

    expect(updated).toBeDefined();
    expect(updated!.label).toBe('Updated');
    expect(updated!.behavior).toBe('fail');
    expect(updated!.behavior_config).toEqual({ error_message: 'Custom error' });
  });

  it('deletes a phone number', () => {
    const phone = createPhoneNumber(db, { number: '+40755555555', label: 'Delete Me', behavior: 'deliver' });
    const deleted = deletePhoneNumber(db, phone.id);
    expect(deleted).toBe(true);

    const found = getPhoneNumberById(db, phone.id);
    expect(found).toBeUndefined();
  });

  it('rejects duplicate numbers', () => {
    createPhoneNumber(db, { number: '+40766666666', label: 'First', behavior: 'deliver' });
    expect(() => {
      createPhoneNumber(db, { number: '+40766666666', label: 'Duplicate', behavior: 'deliver' });
    }).toThrow();
  });
});
