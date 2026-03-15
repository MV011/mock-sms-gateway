import type { Message } from '../lib/api';

interface MessageBubbleProps {
  message: Message;
  showDate?: boolean;
}

export default function MessageBubble({ message, showDate }: MessageBubbleProps) {
  const isOutbound = message.direction === 'outbound';

  return (
    <>
      {/* Date separator */}
      {showDate && (
        <div className="my-3 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#21262d]" />
          <span className="text-xs text-gray-500">
            {formatDate(message.created_at)}
          </span>
          <div className="h-px flex-1 bg-[#21262d]" />
        </div>
      )}

      {/* Bubble */}
      <div
        className={`flex gap-2 ${isOutbound ? 'justify-start' : 'justify-end'}`}
      >
        {/* Icon for outbound */}
        {isOutbound && (
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#238636]/20 text-xs text-[#238636]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
            </svg>
          </div>
        )}

        <div
          className={`max-w-[75%] rounded-lg px-3 py-2 ${
            isOutbound
              ? 'bg-[#238636]/15 text-gray-200'
              : 'bg-[#1f6feb]/15 text-gray-200'
          }`}
        >
          {/* Body */}
          <p className="whitespace-pre-wrap break-words text-sm">
            {message.body}
          </p>

          {/* Metadata row */}
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
            {/* Template key */}
            {message.template_key && (
              <span className="rounded bg-[#21262d] px-1.5 py-0.5">
                {message.template_key}
              </span>
            )}

            {/* Status badge */}
            {isOutbound && (
              <span
                className={`flex items-center gap-0.5 ${
                  message.status === 'delivered'
                    ? 'text-[#238636]'
                    : message.status === 'failed'
                      ? 'text-red-400'
                      : message.status === 'rejected'
                        ? 'text-orange-400'
                        : 'text-gray-500'
                }`}
              >
                {message.status === 'delivered' ? '\u2713' : '\u2717'}{' '}
                {message.status.charAt(0).toUpperCase() + message.status.slice(1)}
              </span>
            )}

            {/* From name */}
            {message.from_name && (
              <span className="text-gray-500">
                from: {message.from_name}
              </span>
            )}

            {/* Webhook status (for inbound) */}
            {!isOutbound && message.webhook_status && (
              <span
                className={
                  message.webhook_status === 'sent'
                    ? 'text-[#238636]'
                    : 'text-red-400'
                }
              >
                webhook: {message.webhook_status}
              </span>
            )}

            {/* Timestamp */}
            <span className="ml-auto">
              {formatTimestamp(message.created_at)}
            </span>
          </div>
        </div>

        {/* Icon for inbound */}
        {!isOutbound && (
          <div className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#1f6feb]/20 text-xs text-[#1f6feb]">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          </div>
        )}
      </div>
    </>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimestamp(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}
