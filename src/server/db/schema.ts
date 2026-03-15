export const SCHEMA = `
  CREATE TABLE IF NOT EXISTS phone_numbers (
    id            TEXT PRIMARY KEY,
    number        TEXT UNIQUE NOT NULL,
    label         TEXT,
    country_code  TEXT,
    behavior      TEXT NOT NULL DEFAULT 'deliver'
                  CHECK (behavior IN ('deliver', 'fail', 'delay', 'reject', 'rate_limit', 'timeout')),
    behavior_config JSON,
    is_magic      INTEGER NOT NULL DEFAULT 0,
    pinned        INTEGER NOT NULL DEFAULT 0,
    created_at    TEXT NOT NULL,
    updated_at    TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS messages (
    id              TEXT PRIMARY KEY,
    phone_id        TEXT REFERENCES phone_numbers(id) ON DELETE SET NULL,
    phone_number    TEXT NOT NULL,
    direction       TEXT NOT NULL CHECK (direction IN ('outbound', 'inbound')),
    body            TEXT NOT NULL,
    from_name       TEXT,
    template_key    TEXT,
    status          TEXT NOT NULL CHECK (status IN ('delivered', 'failed', 'pending', 'rejected')),
    error_message   TEXT,
    metadata        JSON,
    webhook_status  TEXT,
    created_at      TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value JSON NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_messages_phone_id_created
    ON messages(phone_id, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_messages_phone_number_created
    ON messages(phone_number, created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_messages_created
    ON messages(created_at DESC);

  CREATE INDEX IF NOT EXISTS idx_phone_numbers_number
    ON phone_numbers(number);
`;
