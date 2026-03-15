import { useState, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import type { PhoneNumber, Message } from '../lib/api';

// Behavior indicator icons
const BEHAVIOR_ICONS: Record<string, string> = {
  fail: '\u26A1',
  delay: '\uD83D\uDC22',
  reject: '\uD83D\uDEAB',
  rate_limit: '\u23F1\uFE0F',
  timeout: '\u23F3',
};

interface SidebarProps {
  numbers: PhoneNumber[];
  messages: Message[];
  catchAllCount: number;
  unreadCounts: Record<string, number>;
  selectedId: string | null;
  onSelect: (id: string | null) => void;
}

export default function Sidebar({
  numbers,
  messages,
  catchAllCount,
  unreadCounts,
  selectedId,
  onSelect,
}: SidebarProps) {
  const [search, setSearch] = useState('');
  const location = useLocation();

  // Compute last message per phone number
  const numberMeta = useMemo(() => {
    const map = new Map<
      string,
      { lastMessage: Message | null }
    >();

    for (const num of numbers) {
      const numMessages = messages.filter((m) => m.phone_id === num.id);
      const last = numMessages.length > 0 ? numMessages[numMessages.length - 1] : null;
      map.set(num.id, { lastMessage: last });
    }

    return map;
  }, [numbers, messages]);

  // Filter numbers by search
  const filtered = useMemo(() => {
    if (!search.trim()) return numbers;
    const q = search.toLowerCase();
    return numbers.filter(
      (n) =>
        n.number.toLowerCase().includes(q) ||
        (n.label && n.label.toLowerCase().includes(q)),
    );
  }, [numbers, search]);

  // Separate pinned and unpinned
  const pinned = filtered.filter((n) => n.pinned);
  const unpinned = filtered.filter((n) => !n.pinned);

  return (
    <aside className="flex h-full w-[280px] shrink-0 flex-col border-r border-[#21262d] bg-[#0d1117]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#21262d] px-4 py-3">
        <h1 className="text-sm font-semibold text-gray-200">SMS Inbox</h1>
        <Link
          to="/settings"
          className={`rounded p-1.5 text-gray-400 transition-colors hover:bg-[#161b22] hover:text-gray-200 ${
            location.pathname === '/settings' ? 'bg-[#161b22] text-gray-200' : ''
          }`}
          title="Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </Link>
      </div>

      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          placeholder="Search numbers..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-[#30363d] bg-[#010409] px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 outline-none focus:border-[#4ecdc4] focus:ring-1 focus:ring-[#4ecdc4]"
        />
      </div>

      {/* Number list */}
      <div className="flex-1 overflow-y-auto">
        {pinned.length > 0 && (
          <div>
            {pinned.map((num) => (
              <NumberItem
                key={num.id}
                phone={num}
                meta={numberMeta.get(num.id)}
                unread={unreadCounts[num.id] ?? 0}
                isSelected={selectedId === num.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {unpinned.length > 0 && (
          <div>
            {pinned.length > 0 && (
              <div className="mx-3 my-1 border-t border-[#21262d]" />
            )}
            {unpinned.map((num) => (
              <NumberItem
                key={num.id}
                phone={num}
                meta={numberMeta.get(num.id)}
                unread={unreadCounts[num.id] ?? 0}
                isSelected={selectedId === num.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        )}

        {filtered.length === 0 && (
          <p className="px-4 py-6 text-center text-xs text-gray-500">
            No numbers found
          </p>
        )}
      </div>

      {/* Catch-all bucket */}
      <div className="border-t border-[#21262d]">
        <button
          onClick={() => onSelect(null)}
          className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
            selectedId === null
              ? 'bg-[#161b22] text-gray-200'
              : 'text-gray-400 hover:bg-[#161b22]/50'
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#21262d] text-sm">
            *
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-medium">Catch-All</div>
            <div className="truncate text-xs text-gray-500">
              Unrecognized numbers
            </div>
          </div>
          {(unreadCounts.__catch_all__ ?? 0) > 0 && (
            <span className="shrink-0 animate-pulse rounded-full bg-[#4ecdc4] px-2 py-0.5 text-xs font-medium text-[#010409]">
              {unreadCounts.__catch_all__}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
}

// ---------- Number item ----------

function NumberItem({
  phone,
  meta,
  unread,
  isSelected,
  onSelect,
}: {
  phone: PhoneNumber;
  meta?: { lastMessage: Message | null };
  unread: number;
  isSelected: boolean;
  onSelect: (id: string) => void;
}) {
  const behaviorIcon = BEHAVIOR_ICONS[phone.behavior] ?? '';
  const lastMsg = meta?.lastMessage;
  const hasUnread = unread > 0 && !isSelected;

  return (
    <button
      onClick={() => onSelect(phone.id)}
      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isSelected
          ? 'bg-[#161b22] text-gray-200'
          : hasUnread
            ? 'bg-[#161b22]/30 text-gray-100 hover:bg-[#161b22]/60'
            : 'text-gray-300 hover:bg-[#161b22]/50'
      }`}
    >
      {/* Avatar / indicator */}
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm ${
        hasUnread ? 'bg-[#4ecdc4]/20 text-[#4ecdc4]' : 'bg-[#21262d]'
      }`}>
        {behaviorIcon || phone.number.slice(-2)}
      </span>

      {/* Details */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className={`truncate text-sm ${hasUnread ? 'font-semibold' : 'font-medium'}`}>
            {phone.label || phone.number}
          </span>
          {phone.is_magic && (
            <span className="shrink-0 text-[10px] text-gray-500" title="Magic number">
              M
            </span>
          )}
        </div>
        <div className={`truncate text-xs ${hasUnread ? 'text-gray-300' : 'text-gray-500'}`}>
          {lastMsg ? lastMsg.body : phone.number}
        </div>
      </div>

      {/* Unread badge or timestamp */}
      {hasUnread ? (
        <span className="shrink-0 animate-pulse rounded-full bg-[#4ecdc4] px-2 py-0.5 text-xs font-bold text-[#010409]">
          {unread}
        </span>
      ) : lastMsg ? (
        <span className="shrink-0 text-[10px] text-gray-500">
          {formatTime(lastMsg.created_at)}
        </span>
      ) : null}
    </button>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const isToday =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();

  if (isToday) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
