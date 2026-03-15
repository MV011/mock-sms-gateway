import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api, type PhoneNumber, type Message } from '../lib/api';
import { useWebSocket } from '../hooks/useWebSocket';
import Sidebar from '../components/Sidebar';
import Conversation from '../components/Conversation';

export default function Inbox() {
  const [numbers, setNumbers] = useState<PhoneNumber[]>([]);
  const [allMessages, setAllMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCatchAll, setIsCatchAll] = useState(false);
  const [loading, setLoading] = useState(true);

  // Track last-seen message ID per phone (and catch-all)
  // Key: phone_id or "__catch_all__"
  const [lastSeen, setLastSeen] = useState<Record<string, string>>({});

  // ---------- Initial data load ----------

  const loadData = useCallback(async () => {
    try {
      const [nums, msgs] = await Promise.all([
        api.getNumbers(),
        api.getMessages({ limit: 1000 }),
      ]);
      setNumbers(nums);
      setAllMessages(msgs.data);
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ---------- Selection + mark as read ----------

  const handleSelect = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedId(null);
      setIsCatchAll(true);
      // Mark catch-all as read — find the latest catch-all message
      setAllMessages((msgs) => {
        const catchAllMsgs = msgs.filter((m) => m.phone_id === null);
        const last = catchAllMsgs[catchAllMsgs.length - 1];
        if (last) {
          setLastSeen((prev) => ({ ...prev, __catch_all__: last.id }));
        }
        return msgs;
      });
    } else {
      setSelectedId(id);
      setIsCatchAll(false);
      // Mark this conversation as read
      setAllMessages((msgs) => {
        const phoneMsgs = msgs.filter((m) => m.phone_id === id);
        const last = phoneMsgs[phoneMsgs.length - 1];
        if (last) {
          setLastSeen((prev) => ({ ...prev, [id]: last.id }));
        }
        return msgs;
      });
    }
  }, []);

  // ---------- WebSocket integration ----------

  useWebSocket({
    onMessageNew: useCallback((msg: Message) => {
      setAllMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
      // Auto-mark as read if the user is currently viewing this conversation
      setSelectedId((currentId) => {
        if (msg.phone_id && msg.phone_id === currentId) {
          setLastSeen((prev) => ({ ...prev, [msg.phone_id!]: msg.id }));
        }
        if (!msg.phone_id && isCatchAll) {
          setLastSeen((prev) => ({ ...prev, __catch_all__: msg.id }));
        }
        return currentId;
      });
    }, [isCatchAll]),

    onMessageStatus: useCallback((data: { id: string; status: string }) => {
      setAllMessages((prev) =>
        prev.map((m) =>
          m.id === data.id ? { ...m, status: data.status as Message['status'] } : m,
        ),
      );
    }, []),

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
      setSelectedId((prev) => (prev === data.id ? null : prev));
    }, []),

    onMessagesCleared: useCallback((data: { phone_id: string | null }) => {
      if (data.phone_id) {
        setAllMessages((prev) =>
          prev.filter((m) => m.phone_id !== data.phone_id),
        );
      } else {
        setAllMessages([]);
      }
    }, []),

    onReset: useCallback(() => {
      loadData();
    }, [loadData]),
  });

  // ---------- Derived state ----------

  const selectedPhone = useMemo(
    () => numbers.find((n) => n.id === selectedId) ?? null,
    [numbers, selectedId],
  );

  const conversationMessages = useMemo(() => {
    if (isCatchAll) {
      return allMessages.filter((m) => m.phone_id === null);
    }
    if (selectedId) {
      return allMessages.filter((m) => m.phone_id === selectedId);
    }
    return [];
  }, [allMessages, selectedId, isCatchAll]);

  const catchAllCount = useMemo(
    () => allMessages.filter((m) => m.phone_id === null).length,
    [allMessages],
  );

  // Compute unread counts per phone number
  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};

    for (const num of numbers) {
      const phoneMsgs = allMessages.filter((m) => m.phone_id === num.id);
      const lastSeenId = lastSeen[num.id];
      if (!lastSeenId) {
        // Never opened — all messages are unread
        counts[num.id] = phoneMsgs.length;
      } else {
        const lastSeenIndex = phoneMsgs.findIndex((m) => m.id === lastSeenId);
        counts[num.id] = lastSeenIndex >= 0 ? phoneMsgs.length - lastSeenIndex - 1 : phoneMsgs.length;
      }
    }

    // Catch-all unread
    const catchAllMsgs = allMessages.filter((m) => m.phone_id === null);
    const catchAllSeenId = lastSeen.__catch_all__;
    if (!catchAllSeenId) {
      counts.__catch_all__ = catchAllMsgs.length;
    } else {
      const idx = catchAllMsgs.findIndex((m) => m.id === catchAllSeenId);
      counts.__catch_all__ = idx >= 0 ? catchAllMsgs.length - idx - 1 : catchAllMsgs.length;
    }

    return counts;
  }, [allMessages, numbers, lastSeen]);

  // ---------- Render ----------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-[#010409] text-gray-500">
        <p className="text-sm">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <Sidebar
        numbers={numbers}
        messages={allMessages}
        catchAllCount={catchAllCount}
        unreadCounts={unreadCounts}
        selectedId={isCatchAll ? null : selectedId}
        onSelect={handleSelect}
      />
      <Conversation
        phone={isCatchAll ? null : selectedPhone}
        messages={conversationMessages}
        isCatchAll={isCatchAll}
      />
    </div>
  );
}
