#!/usr/bin/env node

import { Command } from 'commander';

const BASE_URL = process.env.SMS_MOCK_URL ?? 'http://localhost:8026';
const API_KEY = process.env.API_KEY;

// ---------- HTTP helpers ----------

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'Content-Type': 'application/json' };
  if (API_KEY) h['X-API-Key'] = API_KEY;
  return h;
}

async function api(
  method: string,
  path: string,
  body?: unknown,
): Promise<unknown> {
  const url = `${BASE_URL}/api/v1${path}`;
  const res = await fetch(url, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });

  // 204 No Content
  if (res.status === 204) return null;

  const text = await res.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    if (!res.ok) {
      throw new Error(`${res.status} ${text || res.statusText}`);
    }
    data = text;
  }

  if (!res.ok) {
    const msg = (data as Record<string, unknown>).error ?? res.statusText;
    throw new Error(`${res.status} ${msg}`);
  }

  return data;
}

// ---------- Output helpers ----------

function printJson(data: unknown): void {
  console.log(JSON.stringify(data, null, 2));
}

function printTable(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string; width?: number }[],
): void {
  if (rows.length === 0) {
    console.log('(no results)');
    return;
  }

  const widths = columns.map((col) => {
    const maxData = rows.reduce((max, row) => {
      const val = String(row[col.key] ?? '');
      return Math.max(max, val.length);
    }, 0);
    return Math.max(col.width ?? 0, col.label.length, maxData);
  });

  // Header
  const header = columns.map((col, i) => col.label.padEnd(widths[i])).join('  ');
  console.log(header);
  console.log(widths.map((w) => '-'.repeat(w)).join('  '));

  // Rows
  for (const row of rows) {
    const line = columns
      .map((col, i) => String(row[col.key] ?? '').padEnd(widths[i]))
      .join('  ');
    console.log(line);
  }
}

// ---------- Magic number presets ----------

const MAGIC_PRESETS: Record<
  string,
  { number: string; label: string; behavior: string; behavior_config?: Record<string, unknown> }
> = {
  deliver: { number: '+40700000001', label: 'Always Deliver', behavior: 'deliver' },
  fail: {
    number: '+40700000002',
    label: 'Always Fail',
    behavior: 'fail',
    behavior_config: { error_message: 'Simulated provider error' },
  },
  delay: {
    number: '+40700000003',
    label: 'Slow Delivery (3s)',
    behavior: 'delay',
    behavior_config: { delay_ms: 3000 },
  },
  reject: {
    number: '+40700000004',
    label: 'Invalid Number',
    behavior: 'reject',
    behavior_config: { error_message: 'Invalid phone number' },
  },
  rate_limit: {
    number: '+40700000005',
    label: 'Rate Limited (5/hr)',
    behavior: 'rate_limit',
    behavior_config: { max_messages: 5, window_seconds: 3600 },
  },
  timeout: {
    number: '+40700000006',
    label: 'Timeout (30s)',
    behavior: 'timeout',
    behavior_config: { timeout_ms: 30000 },
  },
};

// ---------- CLI ----------

const program = new Command();

program
  .name('sms-mock')
  .description('CLI for the Mock SMS Gateway')
  .version('1.0.0');

// --- send ---
program
  .command('send')
  .description('Send an SMS message')
  .requiredOption('--to <phone>', 'Destination phone number')
  .requiredOption('--body <text>', 'Message body')
  .option('--from <name>', 'Sender name')
  .option('--template <key>', 'Template key')
  .action(async (opts) => {
    const payload: Record<string, unknown> = { to: opts.to, body: opts.body };
    if (opts.from) payload.from = opts.from;
    if (opts.template) payload.template_key = opts.template;

    const result = await api('POST', '/send', payload);
    printJson(result);
  });

// --- messages ---
program
  .command('messages')
  .description('List messages')
  .option('--phone <number>', 'Filter by phone number (looks up phone_id)')
  .option('--limit <n>', 'Max results', '50')
  .option('--catch-all', 'Show only catch-all messages (no registered number)')
  .action(async (opts) => {
    const params = new URLSearchParams();
    if (opts.limit) params.set('limit', opts.limit);
    if (opts.catchAll) params.set('catch_all', 'true');

    // If --phone is given, resolve it to a phone_id via the numbers list
    if (opts.phone) {
      const numbers = (await api('GET', '/numbers')) as Array<{ id: string; number: string }>;
      const match = numbers.find((n) => n.number === opts.phone);
      if (match) {
        params.set('phone_id', match.id);
      } else {
        // No registered number, show catch-all filtered by phone
        params.set('catch_all', 'true');
      }
    }

    const qs = params.toString();
    const result = (await api('GET', `/messages${qs ? `?${qs}` : ''}`)) as {
      data: Array<Record<string, unknown>>;
      total: number;
    };

    if (result.data.length === 0) {
      console.log('(no messages)');
      return;
    }

    printTable(
      result.data.map((m) => ({
        id: (m.id as string).slice(0, 8),
        direction: m.direction,
        status: m.status,
        phone: m.phone_number,
        body:
          String(m.body ?? '').length > 50
            ? String(m.body).slice(0, 47) + '...'
            : m.body,
        time: m.created_at,
      })),
      [
        { key: 'id', label: 'ID', width: 8 },
        { key: 'direction', label: 'DIR', width: 8 },
        { key: 'status', label: 'STATUS', width: 9 },
        { key: 'phone', label: 'PHONE', width: 14 },
        { key: 'body', label: 'BODY', width: 20 },
        { key: 'time', label: 'TIME', width: 24 },
      ],
    );
    console.log(`\nTotal: ${result.total}`);
  });

// --- wait ---
program
  .command('wait')
  .description('Wait for a message to arrive for a phone number')
  .requiredOption('--phone <phone>', 'Phone number to watch')
  .option('--contains <text>', 'Wait for a message containing this text')
  .option('--timeout <seconds>', 'Timeout in seconds', '30')
  .action(async (opts) => {
    const timeout = parseInt(opts.timeout, 10) * 1000;
    const interval = 1000;
    const start = Date.now();

    // Resolve phone to phone_id
    const numbers = (await api('GET', '/numbers')) as Array<{ id: string; number: string }>;
    const match = numbers.find((n) => n.number === opts.phone);

    // Track which messages we've already seen
    const seenIds = new Set<string>();

    // Snapshot existing messages so we only find new ones
    const params = new URLSearchParams({ limit: '100', direction: 'inbound' });
    if (match) {
      params.set('phone_id', match.id);
    } else {
      params.set('catch_all', 'true');
    }

    const initial = (await api('GET', `/messages?${params.toString()}`)) as {
      data: Array<{ id: string }>;
    };
    for (const m of initial.data) {
      seenIds.add(m.id);
    }

    // Poll for new messages
    while (Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, interval));

      const result = (await api('GET', `/messages?${params.toString()}`)) as {
        data: Array<Record<string, unknown>>;
      };

      for (const msg of result.data) {
        if (seenIds.has(msg.id as string)) continue;

        if (opts.contains) {
          if (!String(msg.body ?? '').includes(opts.contains)) {
            seenIds.add(msg.id as string);
            continue;
          }
        }

        // Found a match
        printJson(msg);
        return;
      }
    }

    console.error(`Timed out after ${opts.timeout}s waiting for message`);
    process.exit(1);
  });

// --- reply ---
program
  .command('reply')
  .description('Simulate an inbound SMS reply')
  .requiredOption('--from <phone>', 'Phone number the reply comes from')
  .requiredOption('--body <text>', 'Reply message body')
  .action(async (opts) => {
    const result = await api('POST', '/reply', { from: opts.from, body: opts.body });
    printJson(result);
  });

// --- numbers ---
const numbersCmd = program
  .command('numbers')
  .description('Manage phone numbers');

numbersCmd
  .command('list')
  .description('List all phone numbers')
  .action(async () => {
    const numbers = (await api('GET', '/numbers')) as Array<Record<string, unknown>>;

    if (numbers.length === 0) {
      console.log('(no numbers)');
      return;
    }

    printTable(
      numbers.map((n) => ({
        id: (n.id as string).slice(0, 8),
        number: n.number,
        label: n.label ?? '',
        behavior: n.behavior,
        magic: n.is_magic ? 'yes' : '',
        pinned: n.pinned ? 'yes' : '',
      })),
      [
        { key: 'id', label: 'ID', width: 8 },
        { key: 'number', label: 'NUMBER', width: 14 },
        { key: 'label', label: 'LABEL', width: 20 },
        { key: 'behavior', label: 'BEHAVIOR', width: 10 },
        { key: 'magic', label: 'MAGIC', width: 5 },
        { key: 'pinned', label: 'PINNED', width: 6 },
      ],
    );
  });

numbersCmd
  .command('add')
  .description('Add a phone number or magic number preset')
  .option('--number <phone>', 'Phone number in E.164 format')
  .option('--label <name>', 'Label for the number')
  .option('--behavior <type>', 'Behavior: deliver, fail, delay, reject, rate_limit, timeout')
  .option('--magic <behavior>', 'Add a preset magic number by behavior name')
  .action(async (opts) => {
    if (opts.magic) {
      const preset = MAGIC_PRESETS[opts.magic];
      if (!preset) {
        console.error(
          `Unknown magic preset: ${opts.magic}\nAvailable: ${Object.keys(MAGIC_PRESETS).join(', ')}`,
        );
        process.exit(1);
      }

      const payload: Record<string, unknown> = {
        number: preset.number,
        label: preset.label,
        behavior: preset.behavior,
      };
      if (preset.behavior_config) payload.behavior_config = preset.behavior_config;

      const result = await api('POST', '/numbers', payload);
      printJson(result);
      return;
    }

    if (!opts.number) {
      console.error('Either --number or --magic is required');
      process.exit(1);
    }

    const payload: Record<string, unknown> = {
      number: opts.number,
      behavior: opts.behavior ?? 'deliver',
    };
    if (opts.label) payload.label = opts.label;

    const result = await api('POST', '/numbers', payload);
    printJson(result);
  });

numbersCmd
  .command('generate')
  .description('Generate a random phone number')
  .option('--country <code>', 'Country code (RO, US, GB, DE, FR)', 'US')
  .action(async (opts) => {
    const result = await api('POST', '/numbers/generate', { country_code: opts.country });
    printJson(result);
  });

numbersCmd
  .command('delete')
  .description('Delete a phone number')
  .requiredOption('--id <uuid>', 'Phone number ID')
  .action(async (opts) => {
    await api('DELETE', `/numbers/${opts.id}`);
    console.log('Deleted.');
  });

// --- clear ---
program
  .command('clear')
  .description('Clear messages or reset everything')
  .option('--phone-id <uuid>', 'Clear messages for a specific phone number ID')
  .option('--reset', 'Full reset: clear all messages, numbers, and re-seed magic numbers')
  .action(async (opts) => {
    if (opts.reset) {
      await api('POST', '/reset');
      console.log('Reset complete. Magic numbers re-seeded.');
      return;
    }

    const params = opts.phoneId ? `?phone_id=${opts.phoneId}` : '';
    await api('DELETE', `/messages${params}`);
    console.log('Messages cleared.');
  });

// --- stats ---
program
  .command('stats')
  .description('Show message statistics')
  .action(async () => {
    const data = (await api('GET', '/stats')) as Record<string, number>;
    const maxLabel = Math.max(...Object.keys(data).map((k) => k.length));
    for (const [key, value] of Object.entries(data)) {
      console.log(`${key.padEnd(maxLabel)}  ${value}`);
    }
  });

// --- Error handling wrapper ---
async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    // Filter out commander's own exit (e.g. --help, missing args)
    if (message.includes('commander.helpDisplayed') || message.includes('commander.version')) {
      return;
    }
    console.error(`Error: ${message}`);
    process.exit(1);
  }
}

main();
