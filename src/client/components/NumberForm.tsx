import { useState, type FormEvent } from 'react';
import { api, type Behavior, type CreateNumberInput } from '../lib/api';

// Country presets
const COUNTRY_PRESETS = [
  { code: 'RO', flag: '\uD83C\uDDF7\uD83C\uDDF4', prefix: '+407', label: 'Romania' },
  { code: 'US', flag: '\uD83C\uDDFA\uD83C\uDDF8', prefix: '+1', label: 'United States' },
  { code: 'GB', flag: '\uD83C\uDDEC\uD83C\uDDE7', prefix: '+44', label: 'United Kingdom' },
  { code: 'DE', flag: '\uD83C\uDDE9\uD83C\uDDEA', prefix: '+49', label: 'Germany' },
  { code: 'FR', flag: '\uD83C\uDDEB\uD83C\uDDF7', prefix: '+33', label: 'France' },
];

// Magic number presets
const MAGIC_PRESETS = [
  { label: 'Always Deliver', behavior: 'deliver' as Behavior, number: '+40700000001', config: null },
  { label: 'Always Fail', behavior: 'fail' as Behavior, number: '+40700000002', config: { error_message: 'Simulated provider error' } },
  { label: 'Slow Delivery (3s)', behavior: 'delay' as Behavior, number: '+40700000003', config: { delay_ms: 3000 } },
  { label: 'Invalid Number', behavior: 'reject' as Behavior, number: '+40700000004', config: { error_message: 'Invalid phone number' } },
  { label: 'Rate Limited (5/hr)', behavior: 'rate_limit' as Behavior, number: '+40700000005', config: { max_messages: 5, window_seconds: 3600 } },
  { label: 'Timeout (30s)', behavior: 'timeout' as Behavior, number: '+40700000006', config: { timeout_ms: 30000 } },
];

// Behavior options
const BEHAVIORS: { value: Behavior; label: string }[] = [
  { value: 'deliver', label: 'Deliver' },
  { value: 'fail', label: 'Fail' },
  { value: 'delay', label: 'Delay' },
  { value: 'reject', label: 'Reject' },
  { value: 'rate_limit', label: 'Rate Limit' },
  { value: 'timeout', label: 'Timeout' },
];

interface NumberFormProps {
  onCreated: () => void;
}

export default function NumberForm({ onCreated }: NumberFormProps) {
  const [number, setNumber] = useState('');
  const [label, setLabel] = useState('');
  const [countryCode, setCountryCode] = useState('RO');
  const [behavior, setBehavior] = useState<Behavior>('deliver');
  const [errorMessage, setErrorMessage] = useState('');
  const [delayMs, setDelayMs] = useState(3000);
  const [maxMessages, setMaxMessages] = useState(5);
  const [windowSeconds, setWindowSeconds] = useState(3600);
  const [timeoutMs, setTimeoutMs] = useState(30000);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildBehaviorConfig = (): Record<string, unknown> | undefined => {
    switch (behavior) {
      case 'fail':
        return errorMessage ? { error_message: errorMessage } : undefined;
      case 'delay':
        return { delay_ms: delayMs };
      case 'reject':
        return errorMessage ? { error_message: errorMessage } : undefined;
      case 'rate_limit':
        return { max_messages: maxMessages, window_seconds: windowSeconds };
      case 'timeout':
        return { timeout_ms: timeoutMs };
      default:
        return undefined;
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!number.trim() || submitting) return;

    setError(null);
    setSubmitting(true);

    const input: CreateNumberInput = {
      number: number.trim(),
      label: label.trim() || undefined,
      country_code: countryCode,
      behavior,
      behavior_config: buildBehaviorConfig(),
    };

    try {
      await api.createNumber(input);
      // Reset form
      setNumber('');
      setLabel('');
      setBehavior('deliver');
      setErrorMessage('');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create number');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCountrySelect = (code: string) => {
    setCountryCode(code);
    const preset = COUNTRY_PRESETS.find((p) => p.code === code);
    if (preset && !number) {
      setNumber(preset.prefix);
    }
  };

  const handleMagicPreset = async (preset: typeof MAGIC_PRESETS[number]) => {
    setSubmitting(true);
    setError(null);
    try {
      await api.createNumber({
        number: preset.number,
        label: preset.label,
        country_code: 'RO',
        behavior: preset.behavior,
        behavior_config: preset.config ?? undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create magic number');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGenerate = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await api.generateNumber(countryCode);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate number');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Add number form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-200">Add Phone Number</h3>

        {/* Country presets */}
        <div className="flex gap-2">
          {COUNTRY_PRESETS.map((preset) => (
            <button
              key={preset.code}
              type="button"
              onClick={() => handleCountrySelect(preset.code)}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                countryCode === preset.code
                  ? 'bg-[#4ecdc4]/20 text-[#4ecdc4] ring-1 ring-[#4ecdc4]/50'
                  : 'bg-[#21262d] text-gray-400 hover:bg-[#30363d]'
              }`}
            >
              {preset.flag} {preset.code}
            </button>
          ))}
        </div>

        {/* Number + Label */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Phone Number</label>
            <input
              type="text"
              value={number}
              onChange={(e) => setNumber(e.target.value)}
              placeholder="+40712345678"
              required
              className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Label</label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Patient Test"
              className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
            />
          </div>
        </div>

        {/* Behavior selector */}
        <div>
          <label className="mb-1 block text-xs text-gray-400">Behavior</label>
          <div className="flex flex-wrap gap-2">
            {BEHAVIORS.map((b) => (
              <button
                key={b.value}
                type="button"
                onClick={() => setBehavior(b.value)}
                className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                  behavior === b.value
                    ? 'bg-[#4ecdc4]/20 text-[#4ecdc4] ring-1 ring-[#4ecdc4]/50'
                    : 'bg-[#21262d] text-gray-400 hover:bg-[#30363d]'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>

        {/* Behavior config fields */}
        {(behavior === 'fail' || behavior === 'reject') && (
          <div>
            <label className="mb-1 block text-xs text-gray-400">Error Message</label>
            <input
              type="text"
              value={errorMessage}
              onChange={(e) => setErrorMessage(e.target.value)}
              placeholder={behavior === 'fail' ? 'Simulated provider error' : 'Invalid phone number'}
              className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
            />
          </div>
        )}

        {behavior === 'delay' && (
          <div>
            <label className="mb-1 block text-xs text-gray-400">Delay (ms)</label>
            <input
              type="number"
              value={delayMs}
              onChange={(e) => setDelayMs(Number(e.target.value))}
              min={100}
              max={120000}
              className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
            />
          </div>
        )}

        {behavior === 'rate_limit' && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs text-gray-400">Max Messages</label>
              <input
                type="number"
                value={maxMessages}
                onChange={(e) => setMaxMessages(Number(e.target.value))}
                min={1}
                className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-gray-400">Window (seconds)</label>
              <input
                type="number"
                value={windowSeconds}
                onChange={(e) => setWindowSeconds(Number(e.target.value))}
                min={1}
                className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
              />
            </div>
          </div>
        )}

        {behavior === 'timeout' && (
          <div>
            <label className="mb-1 block text-xs text-gray-400">Timeout (ms)</label>
            <input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              min={1000}
              max={120000}
              className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
            />
          </div>
        )}

        {/* Error display */}
        {error && (
          <p className="text-xs text-red-400">{error}</p>
        )}

        {/* Submit + Generate */}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!number.trim() || submitting}
            className="rounded-md bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add Number'}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={submitting}
            className="rounded-md border border-[#30363d] bg-[#21262d] px-4 py-2 text-sm text-gray-300 transition-colors hover:bg-[#30363d] disabled:opacity-50"
          >
            Generate Random
          </button>
        </div>
      </form>

      {/* Magic number presets */}
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-200">Magic Number Presets</h3>
        <div className="grid grid-cols-2 gap-2 lg:grid-cols-3">
          {MAGIC_PRESETS.map((preset) => (
            <button
              key={preset.number}
              onClick={() => handleMagicPreset(preset)}
              disabled={submitting}
              className="rounded-md border border-[#30363d] bg-[#0d1117] px-3 py-2 text-left transition-colors hover:border-[#4ecdc4]/30 hover:bg-[#161b22] disabled:opacity-50"
            >
              <div className="text-xs font-medium text-gray-300">{preset.label}</div>
              <div className="text-[10px] text-gray-500">{preset.number}</div>
              <div className="mt-1 text-[10px] text-[#4ecdc4]">{preset.behavior}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
