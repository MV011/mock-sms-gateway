import { useEffect, useRef } from 'react';
import type { PhoneNumber, Message } from '../lib/api';
import MessageBubble from './MessageBubble';
import ReplyComposer from './ReplyComposer';

// Behavior labels
const BEHAVIOR_LABELS: Record<string, string> = {
  deliver: 'Deliver',
  fail: 'Always Fail',
  delay: 'Delayed',
  reject: 'Reject',
  rate_limit: 'Rate Limited',
  timeout: 'Timeout',
};

interface ConversationProps {
  phone: PhoneNumber | null; // null for catch-all
  messages: Message[];
  isCatchAll?: boolean;
}

export default function Conversation({ phone, messages, isCatchAll }: ConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(messages.length);

  // Auto-scroll on new messages
  useEffect(() => {
    if (messages.length > prevCountRef.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = messages.length;
  }, [messages.length]);

  // Also scroll on initial load / selection change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [phone?.id, isCatchAll]);

  // Empty state
  if (!phone && !isCatchAll) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center bg-[#010409] text-gray-500">
        <svg xmlns="http://www.w3.org/2000/svg" className="mb-3 h-12 w-12 text-[#21262d]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p className="text-sm">Select a conversation</p>
      </div>
    );
  }

  // Determine which dates need separators
  const dateGroups = new Set<string>();
  const showDateFor = messages.map((msg) => {
    const dateKey = new Date(msg.created_at).toDateString();
    if (dateGroups.has(dateKey)) return false;
    dateGroups.add(dateKey);
    return true;
  });

  const phoneNumber = phone?.number ?? '';

  return (
    <div className="flex flex-1 flex-col bg-[#010409]">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-[#21262d] bg-[#0d1117] px-4 py-3">
        {isCatchAll ? (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#21262d] text-sm text-gray-400">
              *
            </span>
            <div>
              <h2 className="text-sm font-semibold text-gray-200">Catch-All</h2>
              <p className="text-xs text-gray-500">
                Messages to unrecognized numbers
              </p>
            </div>
          </>
        ) : (
          <>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#21262d] text-sm text-gray-400">
              {phone!.number.slice(-2)}
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-gray-200">
                {phone!.label || phone!.number}
              </h2>
              <p className="text-xs text-gray-500">
                {phone!.number}
                {phone!.behavior !== 'deliver' && (
                  <span className="ml-2 rounded bg-[#21262d] px-1.5 py-0.5 text-[10px]">
                    {BEHAVIOR_LABELS[phone!.behavior] ?? phone!.behavior}
                  </span>
                )}
              </p>
            </div>
            <div className="text-xs text-gray-500">
              {messages.length} message{messages.length !== 1 ? 's' : ''}
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-gray-500">
            No messages yet
          </p>
        ) : (
          messages.map((msg, i) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              showDate={showDateFor[i]}
            />
          ))
        )}
      </div>

      {/* Reply composer (only for known numbers, not catch-all) */}
      {phone && !isCatchAll && <ReplyComposer phoneNumber={phoneNumber} />}
    </div>
  );
}
