import { useState, useEffect, useCallback, useMemo } from 'react';
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

  // ---------- Selection ----------

  const handleSelect = useCallback((id: string | null) => {
    if (id === null) {
      setSelectedId(null);
      setIsCatchAll(true);
    } else {
      setSelectedId(id);
      setIsCatchAll(false);
    }
  }, []);

  // ---------- WebSocket integration ----------

  useWebSocket({
    onMessageNew: useCallback((msg: Message) => {
      setAllMessages((prev) => {
        // Deduplicate — guard against multiple WebSocket connections (e.g. StrictMode)
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    }, []),

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
