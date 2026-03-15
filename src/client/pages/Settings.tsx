import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { api, type PhoneNumber } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import { BEHAVIOR_LABELS, BEHAVIOR_COLORS } from '../lib/constants';
import NumberForm from '../components/NumberForm';

export default function Settings() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [clearing, setClearing] = useState(false);

  const loadNumbers = useCallback(async () => {
    try {
      const data = await api.getNumbers();
      setNumbers(data);
    } catch (err) {
      console.error('Failed to load numbers:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadNumbers();
  }, [loadNumbers]);

  // WebSocket for live updates
  useWebSocket({
    onNumberCreated: useCallback((phone: PhoneNumber) => {
      setNumbers((prev) => {
        if (prev.some((n) => n.id === phone.id)) return prev;
        return [...prev, phone];
      });
    }, []),

    onNumberUpdated: useCallback((phone: PhoneNumber) => {
      setNumbers((prev) =>
        prev.map((n) => (n.id === phone.id ? phone : n)),
      );
    }, []),

    onNumberDeleted: useCallback((data: { id: string }) => {
      setNumbers((prev) => prev.filter((n) => n.id !== data.id));
    }, []),

    onReset: useCallback(() => {
      loadNumbers();
    }, [loadNumbers]),
  });

  const handleDelete = async (id: string) => {
    try {
      await api.deleteNumber(id);
    } catch (err) {
      console.error('Failed to delete number:', err);
    }
  };

  const handleTogglePin = async (phone: PhoneNumber) => {
    try {
      await api.updateNumber(phone.id, { pinned: !phone.pinned });
    } catch (err) {
      console.error('Failed to update number:', err);
    }
  };

  const handleClearMessages = async () => {
    if (!confirm('Clear all messages? This cannot be undone.')) return;
    setClearing(true);
    try {
      await api.clearMessages();
    } catch (err) {
      console.error('Failed to clear messages:', err);
    } finally {
      setClearing(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Reset everything? This will delete all messages and numbers, then re-seed magic numbers.')) return;
    setResetting(true);
    try {
      await api.reset();
    } catch (err) {
      console.error('Failed to reset:', err);
    } finally {
      setResetting(false);
    }
  };

  return (
    <div className="flex h-full flex-col bg-[#010409]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#21262d] bg-[#0d1117] px-6 py-3">
        <Link
          to="/inbox"
          className="rounded p-1.5 text-gray-400 transition-colors hover:bg-[#161b22] hover:text-gray-200"
          title="Back to Inbox"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
        </Link>
        <h1 className="text-sm font-semibold text-gray-200">Settings</h1>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl space-y-8 px-6 py-6">
          {/* Phone Numbers Table */}
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-base font-semibold text-gray-200">
                Phone Numbers ({numbers.length})
              </h2>
            </div>

            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : numbers.length === 0 ? (
              <p className="rounded-lg border border-[#21262d] bg-[#0d1117] px-4 py-8 text-center text-sm text-gray-500">
                No phone numbers configured. Add one below.
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-[#21262d]">
                <table className="w-full text-sm">
                  <thead className="bg-[#161b22] text-left text-xs text-gray-400">
                    <tr>
                      <th className="px-4 py-2 font-medium">Number</th>
                      <th className="px-4 py-2 font-medium">Label</th>
                      <th className="px-4 py-2 font-medium">Behavior</th>
                      <th className="px-4 py-2 font-medium">Config</th>
                      <th className="px-4 py-2 font-medium">Flags</th>
                      <th className="px-4 py-2 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#21262d]">
                    {numbers.map((phone) => (
                      <tr key={phone.id} className="bg-[#0d1117]">
                        <td className="px-4 py-2 font-mono text-xs text-gray-300">
                          {phone.number}
                        </td>
                        <td className="px-4 py-2 text-gray-300">
                          {phone.label || '--'}
                        </td>
                        <td className="px-4 py-2">
                          <span className={BEHAVIOR_COLORS[phone.behavior] ?? 'text-gray-400'}>
                            {BEHAVIOR_LABELS[phone.behavior] ?? phone.behavior}
                          </span>
                        </td>
                        <td className="max-w-[200px] truncate px-4 py-2 font-mono text-[10px] text-gray-500">
                          {phone.behavior_config
                            ? JSON.stringify(phone.behavior_config)
                            : '--'}
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1.5">
                            {phone.is_magic && (
                              <span className="rounded bg-[#4ecdc4]/15 px-1.5 py-0.5 text-[10px] text-[#4ecdc4]">
                                magic
                              </span>
                            )}
                            {phone.pinned && (
                              <span className="rounded bg-[#1f6feb]/15 px-1.5 py-0.5 text-[10px] text-[#1f6feb]">
                                pinned
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2">
                          <div className="flex gap-1">
                            <button
                              onClick={() => handleTogglePin(phone)}
                              className="rounded p-1 text-gray-500 transition-colors hover:bg-[#21262d] hover:text-gray-300"
                              title={phone.pinned ? 'Unpin' : 'Pin'}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            </button>
                            <button
                              onClick={() => handleDelete(phone.id)}
                              className="rounded p-1 text-gray-500 transition-colors hover:bg-red-900/30 hover:text-red-400"
                              title="Delete"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Add Number Form */}
          <section className="rounded-lg border border-[#21262d] bg-[#0d1117] p-6">
            <NumberForm onCreated={loadNumbers} />
          </section>

          {/* Danger Zone */}
          <section className="rounded-lg border border-red-900/30 bg-[#0d1117] p-6">
            <h2 className="mb-4 text-base font-semibold text-red-400">
              Danger Zone
            </h2>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-md border border-[#21262d] px-4 py-3">
                <div>
                  <p className="text-sm text-gray-300">Clear All Messages</p>
                  <p className="text-xs text-gray-500">
                    Delete all messages but keep phone numbers.
                  </p>
                </div>
                <button
                  onClick={handleClearMessages}
                  disabled={clearing}
                  className="rounded-md border border-red-900/50 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
                >
                  {clearing ? 'Clearing...' : 'Clear Messages'}
                </button>
              </div>

              <div className="flex items-center justify-between rounded-md border border-[#21262d] px-4 py-3">
                <div>
                  <p className="text-sm text-gray-300">Factory Reset</p>
                  <p className="text-xs text-gray-500">
                    Delete all data and re-seed magic numbers.
                  </p>
                </div>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="rounded-md border border-red-900/50 bg-red-900/10 px-3 py-1.5 text-xs text-red-400 transition-colors hover:bg-red-900/20 disabled:opacity-50"
                >
                  {resetting ? 'Resetting...' : 'Reset Everything'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
