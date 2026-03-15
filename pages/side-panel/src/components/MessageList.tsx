import type { Message } from '@agent-guard/storage';
import { ACTOR_PROFILES } from '../types/message';
import { memo } from 'react';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';

interface MessageListProps {
  messages: Message[];
  isDarkMode?: boolean;
}

export default memo(function MessageList({ messages, isDarkMode = false }: MessageListProps) {
  return (
    <div className="max-w-full space-y-4">
      {messages.map((message, index) => (
        <MessageBlock
          key={`${message.actor}-${message.timestamp}-${index}`}
          message={message}
          isSameActor={index > 0 ? messages[index - 1].actor === message.actor : false}
          isDarkMode={isDarkMode}
        />
      ))}
    </div>
  );
});

interface MessageBlockProps {
  message: Message;
  isSameActor: boolean;
  isDarkMode?: boolean;
}

function MessageBlock({ message, isSameActor, isDarkMode = false }: MessageBlockProps) {
  if (!message.actor) {
    console.error('No actor found');
    return <div />;
  }

  const isUser = message.actor === 'user';
  const actor = ACTOR_PROFILES[message.actor as keyof typeof ACTOR_PROFILES];
  const isProgress = message.content === 'Showing progress...';

  return (
    <div className={`flex w-full flex-col ${isUser ? 'items-end' : 'items-start'} ${!isSameActor ? 'mt-6' : 'mt-1'}`}>
      {!isSameActor && !isUser && (
        <div
          className={`mb-1 ml-4 text-[10px] font-bold uppercase tracking-widest ${isDarkMode ? 'text-gray-500' : 'text-guard-muted'}`}>
          {actor.name}
        </div>
      )}

      <div className={isUser ? 'message-user' : 'message-agent'}>
        {isProgress ? (
          <div className="flex items-center gap-3 py-1">
            <AiOutlineLoading3Quarters className="size-4 animate-spin text-guard-muted" />
            <span className="text-xs font-medium text-guard-muted">Thinking...</span>
          </div>
        ) : (
          <div className="whitespace-pre-wrap break-words">{message.content}</div>
        )}
      </div>

      {!isProgress && !isSameActor && (
        <div className={`mt-1 ${isUser ? 'mr-4' : 'ml-4'} text-[10px] opacity-40`}>
          {formatTimestamp(message.timestamp)}
        </div>
      )}
    </div>
  );
}

/**
 * Formats a timestamp (in milliseconds) to a readable time string
 * @param timestamp Unix timestamp in milliseconds
 * @returns Formatted time string
 */
function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();

  // Check if the message is from today
  const isToday = date.toDateString() === now.toDateString();

  // Check if the message is from yesterday
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  // Check if the message is from this year
  const isThisYear = date.getFullYear() === now.getFullYear();

  // Format the time (HH:MM)
  const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isToday) {
    return timeStr; // Just show the time for today's messages
  }

  if (isYesterday) {
    return `Yesterday, ${timeStr}`;
  }

  if (isThisYear) {
    // Show month and day for this year
    return `${date.toLocaleDateString([], { month: 'short', day: 'numeric' })}, ${timeStr}`;
  }

  // Show full date for older messages
  return `${date.toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })}, ${timeStr}`;
}
