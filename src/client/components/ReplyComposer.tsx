import { useState, type FormEvent } from 'react';
import { api } from '../lib/api';

interface ReplyComposerProps {
  phoneNumber: string;
  disabled?: boolean;
}

export default function ReplyComposer({ phoneNumber, disabled }: ReplyComposerProps) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const text = body.trim();
    if (!text || sending) return;

    setSending(true);
    try {
      await api.sendReply({ from: phoneNumber, body: text });
      setBody('');
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-2 border-t border-[#21262d] bg-[#0d1117] px-4 py-3"
    >
      <input
        type="text"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder={`Reply as ${phoneNumber}...`}
        disabled={disabled || sending}
        className="flex-1 rounded-md border border-[#30363d] bg-[#010409] px-3 py-2 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4] disabled:opacity-50"
      />
      <button
        type="submit"
        disabled={!body.trim() || sending || disabled}
        className="rounded-md bg-[#238636] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#2ea043] disabled:opacity-50 disabled:hover:bg-[#238636]"
      >
        {sending ? 'Sending...' : 'Send'}
      </button>
    </form>
  );
}
