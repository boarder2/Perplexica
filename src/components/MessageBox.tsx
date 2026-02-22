import { cn } from '@/lib/utils';
import { Pencil } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { File, ImageAttachment, Message } from './ChatWindow';
import MessageInput from './MessageInput';
import MessageTabs from './MessageTabs';
import { Document } from '@langchain/core/documents';

const MessageBox = ({
  message,
  messageIndex,
  history,
  loading,
  isLast,
  rewrite,
  sendMessage,
  handleEditMessage,
  onThinkBoxToggle,
  analysisProgress,
  modelStats,
  gatheringSources,
  actionMessageId,
  editInputProps,
}: {
  message: Message;
  messageIndex: number;
  history: Message[];
  loading: boolean;
  isLast: boolean;
  rewrite: (messageId: string) => void;
  sendMessage: (
    message: string,
    options?: {
      messageId?: string;
      rewriteIndex?: number;
      suggestions?: string[];
    },
  ) => void;
  handleEditMessage: (
    messageId: string,
    content: string,
    images?: ImageAttachment[],
  ) => void;
  onThinkBoxToggle: (
    messageId: string,
    thinkBoxId: string,
    expanded: boolean,
  ) => void;
  analysisProgress?: {
    message: string;
    current: number;
    total: number;
    subMessage?: string;
  } | null;
  modelStats?: {
    usage?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    usageChat?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
    usageSystem?: {
      input_tokens: number;
      output_tokens: number;
      total_tokens: number;
    };
  } | null;
  gatheringSources?: Array<{
    searchQuery: string;
    sources: Document[];
  }>;
  actionMessageId?: string;
  editInputProps: {
    fileIds: string[];
    setFileIds: (fileIds: string[]) => void;
    files: File[];
    setFiles: (files: File[]) => void;
    focusMode: string;
    setFocusMode: (mode: string) => void;
    systemPromptIds: string[];
    setSystemPromptIds: (ids: string[]) => void;
    sendLocation: boolean;
    setSendLocation: (value: boolean) => void;
    sendPersonalization: boolean;
    setSendPersonalization: (value: boolean) => void;
    personalizationLocation?: string;
    personalizationAbout?: string;
    refreshPersonalization?: () => void;
    imageCapable?: boolean;
  };
}) => {
  // Local state for editing functionality
  const [isEditing, setIsEditing] = useState(false);
  const [editPendingImages, setEditPendingImages] = useState<ImageAttachment[]>(
    [],
  );
  // State for truncation toggle of long user prompts
  const [isExpanded, setIsExpanded] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const contentRef = useRef<HTMLHeadingElement | null>(null);

  // Measure overflow compared to a 3-line clamped state
  useEffect(() => {
    const measureOverflow = () => {
      const el = contentRef.current;
      if (!el) return;
      const hadClamp = el.classList.contains('line-clamp-3');
      if (!hadClamp) el.classList.add('line-clamp-3');
      const overflowing = el.scrollHeight > el.clientHeight + 1;
      setIsOverflowing(overflowing);
      if (!hadClamp) el.classList.remove('line-clamp-3');
    };

    measureOverflow();
    window.addEventListener('resize', measureOverflow);
    return () => {
      window.removeEventListener('resize', measureOverflow);
    };
  }, [message.content]);

  // Initialize editing
  const startEditMessage = () => {
    if (loading) return;
    setIsEditing(true);
    setEditPendingImages(message.images ? [...message.images] : []);
  };

  // Cancel editing
  const cancelEditMessage = () => {
    setIsEditing(false);
    setEditPendingImages([]);
  };

  // Submit edit via the reused MessageInput component
  const handleEditSubmit = (msg: string) => {
    handleEditMessage(message.messageId, msg, editPendingImages);
    setIsEditing(false);
  };

  return (
    <div>
      {message.role === 'user' && (
        <div
          className={cn(
            'w-full',
            messageIndex === 0 ? 'pt-16' : 'pt-8',
            'break-words',
          )}
        >
          {isEditing ? (
            <div className="w-full">
              <MessageInput
                {...editInputProps}
                sendMessage={handleEditSubmit}
                loading={false}
                firstMessage={false}
                pendingImages={editPendingImages}
                setPendingImages={setEditPendingImages}
                initialMessage={message.content}
                onCancelEdit={cancelEditMessage}
              />
            </div>
          ) : (
            <>
              <div className="flex items-start">
                <div className="flex-1 min-w-0">
                  <h2
                    className={cn(
                      'font-medium text-3xl',
                      !isExpanded && 'line-clamp-3',
                    )}
                    id={`user-msg-${message.messageId}`}
                    ref={contentRef}
                    onClick={startEditMessage}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (e.key === ' ') e.preventDefault();
                        startEditMessage();
                      }
                    }}
                  >
                    {message.content}
                  </h2>
                  {isOverflowing && (
                    <button
                      type="button"
                      className="mt-2 text-sm text-accent hover:underline"
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsExpanded((v) => !v);
                      }}
                      aria-expanded={isExpanded}
                      aria-controls={`user-msg-${message.messageId}`}
                      title={isExpanded ? 'Show less' : 'Show more'}
                    >
                      {isExpanded ? 'Show less' : 'Show more'}
                    </button>
                  )}
                  {message.images && message.images.length > 0 && (
                    <div className="flex flex-row gap-2 mt-3 flex-wrap">
                      {message.images.map((img) => (
                        <img
                          key={img.imageId}
                          src={`/api/uploads/images/${img.imageId}`}
                          alt={img.fileName}
                          className="max-h-40 max-w-[200px] object-cover rounded-lg border border-surface-2"
                        />
                      ))}
                    </div>
                  )}
                </div>
                <button
                  onClick={startEditMessage}
                  disabled={loading}
                  className={cn(
                    'ml-3 p-2 rounded-xl border border-surface-2 flex-shrink-0',
                    loading
                      ? 'opacity-40 cursor-not-allowed bg-surface'
                      : 'bg-surface hover:bg-surface-2',
                  )}
                  aria-label="Edit message"
                  title="Edit message"
                >
                  <Pencil size={18} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {message.role === 'assistant' && (
        <MessageTabs
          query={history[messageIndex - 1].content}
          chatHistory={history.slice(0, messageIndex - 1)}
          messageId={message.messageId}
          message={message}
          isLast={isLast}
          loading={loading}
          rewrite={rewrite}
          sendMessage={sendMessage}
          onThinkBoxToggle={onThinkBoxToggle}
          analysisProgress={analysisProgress}
          modelStats={modelStats}
          gatheringSources={gatheringSources}
          actionMessageId={actionMessageId}
        />
      )}
    </div>
  );
};

export default MessageBox;
