import { cn } from '@/lib/utils';
import { Check, Pencil, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { ImageAttachment, Message } from './ChatWindow';
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
  imageCapable = false,
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
  imageCapable?: boolean;
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
}) => {
  // Local state for editing functionality
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editImages, setEditImages] = useState<ImageAttachment[]>([]);
  const [isUploadingEditImage, setIsUploadingEditImage] = useState(false);
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
    setIsEditing(true);
    setEditedContent(message.content);
    setEditImages(message.images ? [...message.images] : []);
  };

  // Cancel editing
  const cancelEditMessage = () => {
    setIsEditing(false);
    setEditedContent('');
    setEditImages([]);
  };

  // Save edits
  const saveEditMessage = () => {
    handleEditMessage(message.messageId, editedContent, editImages);
    setIsEditing(false);
  };

  const uploadEditImageFiles = async (imageFiles: globalThis.File[]) => {
    if (imageFiles.length === 0) return;
    setIsUploadingEditImage(true);
    const formData = new FormData();
    imageFiles.forEach((f) => formData.append('images', f));
    try {
      const res = await fetch('/api/uploads/images', {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok && data.images) {
        setEditImages((prev) => [...prev, ...data.images]);
      }
    } catch (err) {
      console.error('Image upload failed:', err);
    }
    setIsUploadingEditImage(false);
  };

  const handleEditPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!imageCapable) return;
    const items = e.clipboardData?.items;
    if (!items) return;
    const imageFiles: globalThis.File[] = [];
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        const file = items[i].getAsFile();
        if (file) imageFiles.push(file);
      }
    }
    if (imageFiles.length > 0) {
      e.preventDefault();
      uploadEditImageFiles(imageFiles);
    }
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
              <textarea
                className="w-full p-3 text-lg bg-surface rounded-lg transition duration-200 min-h-[120px] font-medium text-fg placeholder:text-fg/40 border border-surface-2 focus:outline-none focus:ring-2 focus:ring-accent/40"
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                onPaste={handleEditPaste}
                placeholder="Edit your message..."
                autoFocus
              />
              {(editImages.length > 0 || isUploadingEditImage) && (
                <div className="flex flex-row gap-2 mt-2 flex-wrap">
                  {editImages.map((img) => (
                    <div
                      key={img.imageId}
                      className="relative flex-shrink-0 group/thumb"
                    >
                      <img
                        src={`/api/uploads/images/${img.imageId}`}
                        alt={img.fileName}
                        className="h-20 w-20 object-cover rounded-lg border border-surface-2"
                      />
                      <button
                        type="button"
                        className="absolute -top-1.5 -right-1.5 bg-surface border border-surface-2 rounded-full p-0.5 opacity-0 group-hover/thumb:opacity-100 transition-opacity"
                        onClick={() =>
                          setEditImages(
                            editImages.filter((i) => i.imageId !== img.imageId),
                          )
                        }
                        aria-label={`Remove ${img.fileName}`}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {isUploadingEditImage && (
                    <div className="h-20 w-20 flex-shrink-0 flex items-center justify-center rounded-lg border border-surface-2 bg-surface-2/50">
                      <div className="w-5 h-5 border-2 border-fg/30 border-t-fg animate-spin rounded-full" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex flex-row space-x-2 mt-3 justify-end">
                <button
                  onClick={cancelEditMessage}
                  className="p-2 rounded-full bg-surface hover:bg-surface-2 border border-surface-2 transition duration-200 text-fg/80"
                  aria-label="Cancel"
                  title="Cancel"
                >
                  <X size={18} />
                </button>
                <button
                  onClick={saveEditMessage}
                  className="p-2 rounded-full bg-accent hover:bg-accent-700 transition duration-200 text-white disabled:opacity-50 disabled:cursor-not-allowed"
                  aria-label="Save changes"
                  title="Save changes"
                  disabled={!editedContent.trim() && editImages.length === 0}
                >
                  <Check size={18} />
                </button>
              </div>
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
                  className="ml-3 p-2 rounded-xl bg-surface hover:bg-surface-2 border border-surface-2 flex-shrink-0"
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
