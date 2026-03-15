import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { FaMicrophone } from 'react-icons/fa';
import { AiOutlineLoading3Quarters } from 'react-icons/ai';
import { t } from '@agent-guard/i18n';

interface ChatInputProps {
  onSendMessage: (text: string, displayText?: string) => void;
  onStopTask: () => void;
  onMicClick?: () => void;
  isRecording?: boolean;
  isProcessingSpeech?: boolean;
  disabled: boolean;
  showStopButton: boolean;
  setContent?: (setter: (text: string) => void) => void;
  isDarkMode?: boolean;
  // Historical session ID - if provided, shows replay button instead of send button
  historicalSessionId?: string | null;
  onReplay?: (sessionId: string) => void;
}

// File attachment interface
interface AttachedFile {
  name: string;
  content: string;
  type: string;
}

export default function ChatInput({
  onSendMessage,
  onStopTask,
  onMicClick,
  isRecording = false,
  isProcessingSpeech = false,
  disabled,
  showStopButton,
  setContent,
  isDarkMode = false,
  historicalSessionId,
  onReplay,
}: ChatInputProps) {
  const [text, setText] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([]);
  const isSendButtonDisabled = useMemo(
    () => disabled || (text.trim() === '' && attachedFiles.length === 0),
    [disabled, text, attachedFiles],
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle text changes and resize textarea
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newText = e.target.value;
    setText(newText);

    // Resize textarea
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  };

  // Expose a method to set content from outside
  useEffect(() => {
    if (setContent) {
      setContent(setText);
    }
  }, [setContent]);

  // Initial resize when component mounts
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 100)}px`;
    }
  }, []);

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmedText = text.trim();

      if (trimmedText || attachedFiles.length > 0) {
        let messageContent = trimmedText;
        let displayContent = trimmedText;

        // Security: Clearly separate user input from file content
        // The background service will sanitize file content using guardrails
        if (attachedFiles.length > 0) {
          const fileContents = attachedFiles
            .map(file => {
              // Tag file content for background service to identify and sanitize
              return `\n\n<guard_file_content type="file" name="${file.name}">\n${file.content}\n</guard_file_content>`;
            })
            .join('\n');

          // Combine user message with tagged file content (for background service)
          messageContent = trimmedText
            ? `${trimmedText}\n\n<guard_attached_files>${fileContents}</guard_attached_files>`
            : `<guard_attached_files>${fileContents}</guard_attached_files>`;

          // Create display version with only filenames (for UI)
          const fileList = attachedFiles.map(file => `📎 ${file.name}`).join('\n');
          displayContent = trimmedText ? `${trimmedText}\n\n${fileList}` : fileList;
        }

        onSendMessage(messageContent, displayContent);
        setText('');
        setAttachedFiles([]);
      }
    },
    [text, attachedFiles, onSendMessage],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        handleSubmit(e);
      }
    },
    [handleSubmit],
  );

  const handleReplay = useCallback(() => {
    if (historicalSessionId && onReplay) {
      onReplay(historicalSessionId);
    }
  }, [historicalSessionId, onReplay]);

  const handleFileSelect = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const newFiles: AttachedFile[] = [];
    const allowedTypes = ['.txt', '.md', '.markdown', '.json', '.csv', '.log', '.xml', '.yaml', '.yml'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();

      // Check if file type is allowed
      if (!allowedTypes.includes(fileExt)) {
        console.warn(`File type ${fileExt} not supported. Only text-based files are allowed.`);
        continue;
      }

      // Check file size (limit to 1MB)
      if (file.size > 1024 * 1024) {
        console.warn(`File ${file.name} is too large. Maximum size is 1MB.`);
        continue;
      }

      try {
        const content = await file.text();
        newFiles.push({
          name: file.name,
          content,
          type: file.type || 'text/plain',
        });
      } catch (error) {
        console.error(`Error reading file ${file.name}:`, error);
      }
    }

    if (newFiles.length > 0) {
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleRemoveFile = useCallback((index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  }, []);

  return (
    <form
      onSubmit={handleSubmit}
      className={`relative ${disabled ? 'opacity-50' : ''}`}
      aria-label={t('chat_input_form')}>
      <div className="flex flex-col gap-2">
        {/* File attachments display */}
        {attachedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2 px-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs glass ${
                  isDarkMode ? 'text-gray-300' : 'text-gray-700'
                }`}>
                <span>📎</span>
                <span className="max-w-[120px] truncate">{file.name}</span>
                <button type="button" onClick={() => handleRemoveFile(index)} className="ml-1 hover:text-red-500">
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="input-box bg-white/70 backdrop-blur-md">
          <button
            type="button"
            onClick={handleFileSelect}
            disabled={disabled}
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 hover:bg-gray-100 hover:text-guard-primary transition-colors">
            <span className="text-xl">+</span>
          </button>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".txt,.md,.markdown,.json,.csv,.log,.xml,.yaml,.yml"
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
            className="chat-input scrollbar-none"
            placeholder={attachedFiles.length > 0 ? 'Add a message...' : t('chat_input_placeholder')}
          />

          <div className="flex items-center gap-2 pr-1">
            {onMicClick && (
              <button
                type="button"
                onClick={onMicClick}
                disabled={disabled || isProcessingSpeech}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isRecording ? 'bg-critical-red text-white' : 'text-guard-muted hover:bg-guard-surface'
                }`}>
                {isProcessingSpeech ? (
                  <AiOutlineLoading3Quarters className="size-4 animate-spin" />
                ) : (
                  <FaMicrophone className={isRecording ? 'animate-pulse' : ''} />
                )}
              </button>
            )}

            {showStopButton ? (
              <button
                type="button"
                onClick={onStopTask}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-critical-red text-white">
                ■
              </button>
            ) : historicalSessionId ? (
              <button
                type="button"
                onClick={handleReplay}
                className="flex h-8 px-4 items-center justify-center rounded-full bg-safe-green text-white font-medium text-sm transition-transform hover:scale-105">
                {t('chat_buttons_replay')}
              </button>
            ) : (
              <button
                type="submit"
                disabled={isSendButtonDisabled}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isSendButtonDisabled
                    ? 'bg-guard-muted opacity-30'
                    : 'bg-guard-primary text-white shadow-lg hover:scale-110 active:scale-95'
                }`}>
                ↑
              </button>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
