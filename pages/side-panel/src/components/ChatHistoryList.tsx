/* eslint-disable react/prop-types */
import { FaTrash } from 'react-icons/fa';
import { BsBookmark } from 'react-icons/bs';
import { t } from '@agent-guard/i18n';

interface ChatSession {
  id: string;
  title: string;
  createdAt: number;
}

interface ChatHistoryListProps {
  sessions: ChatSession[];
  onSessionSelect: (sessionId: string) => void;
  onSessionDelete: (sessionId: string) => void;
  onSessionBookmark: (sessionId: string) => void;
  visible: boolean;
  isDarkMode?: boolean;
}

const ChatHistoryList: React.FC<ChatHistoryListProps> = ({
  sessions,
  onSessionSelect,
  onSessionDelete,
  onSessionBookmark,
  visible,
  isDarkMode = false,
}) => {
  if (!visible) return null;

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <div className="h-full overflow-y-auto p-4">
      <h2 className={`mb-4 text-lg font-semibold ${isDarkMode ? 'text-gray-200' : 'text-gray-800'}`}>
        {t('chat_history_title')}
      </h2>
      {sessions.length === 0 ? (
        <div
          className={`rounded-2xl ${isDarkMode ? 'bg-slate-800/40 text-slate-400' : 'bg-white/40 text-slate-500'} p-8 text-center backdrop-blur-md border border-slate-200/20`}>
          {t('chat_history_empty')}
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map(session => (
            <div
              key={session.id}
              className={`group relative rounded-2xl ${
                isDarkMode
                  ? 'bg-slate-800/60 hover:bg-slate-700/80 border-slate-700/50'
                  : 'bg-white/60 hover:bg-white/80 border-slate-200/60'
              } p-4 backdrop-blur-md transition-all border shadow-sm`}>
              <button onClick={() => onSessionSelect(session.id)} className="w-full text-left" type="button">
                <h3 className={`text-sm font-bold tracking-tight ${isDarkMode ? 'text-slate-100' : 'text-slate-800'}`}>
                  {session.title}
                </h3>
                <p className={`mt-1 text-xs font-medium ${isDarkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                  {formatDate(session.createdAt)}
                </p>
              </button>

              {/* Bookmark button - top right */}
              {onSessionBookmark && (
                <button
                  onClick={e => {
                    e.stopPropagation();
                    onSessionBookmark(session.id);
                  }}
                  className={`absolute right-2 top-2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                    isDarkMode
                      ? 'bg-slate-700 text-sky-400 hover:bg-slate-600'
                      : 'bg-white text-sky-500 hover:bg-gray-100'
                  }`}
                  aria-label={t('chat_history_bookmark')}
                  type="button">
                  <BsBookmark size={14} />
                </button>
              )}

              {/* Delete button - bottom right */}
              <button
                onClick={e => {
                  e.stopPropagation();
                  onSessionDelete(session.id);
                }}
                className={`absolute bottom-2 right-2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 ${
                  isDarkMode
                    ? 'bg-slate-700 text-gray-400 hover:bg-slate-600'
                    : 'bg-white text-gray-500 hover:bg-gray-100'
                }`}
                aria-label={t('chat_history_delete')}
                type="button">
                <FaTrash size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatHistoryList;
